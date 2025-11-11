-- ============================================
-- Supabase 데이터베이스 스키마 생성
-- 프로젝트: SinabroG-Stream-S1
-- ============================================

-- 1. 드론 캡처 테이블
CREATE TABLE IF NOT EXISTS public.drone_captures (
    id BIGSERIAL PRIMARY KEY,
    capture_id TEXT UNIQUE NOT NULL,
    device_id TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    stream_key TEXT NOT NULL,
    title TEXT,
    description TEXT,
    image_url TEXT,
    image_data TEXT, -- Base64 이미지 데이터

    -- 드론 위치 정보
    drone_lat DOUBLE PRECISION,
    drone_lng DOUBLE PRECISION,
    drone_alt DOUBLE PRECISION,
    drone_heading DOUBLE PRECISION,

    -- 메타데이터
    metadata JSONB DEFAULT '{}'::jsonb,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- 공개/비공개
    is_public BOOLEAN DEFAULT false,

    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_drone_captures_device_id ON public.drone_captures(device_id);
CREATE INDEX IF NOT EXISTS idx_drone_captures_stream_key ON public.drone_captures(stream_key);
CREATE INDEX IF NOT EXISTS idx_drone_captures_timestamp ON public.drone_captures(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_drone_captures_tags ON public.drone_captures USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_drone_captures_created_at ON public.drone_captures(created_at DESC);

-- 2. 위치 이력 테이블
CREATE TABLE IF NOT EXISTS public.position_history (
    id BIGSERIAL PRIMARY KEY,
    device_id TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    altitude DOUBLE PRECISION DEFAULT 0,
    speed DOUBLE PRECISION DEFAULT 0,
    heading DOUBLE PRECISION DEFAULT 0,
    battery_level INTEGER,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 추가 메타데이터
    metadata JSONB DEFAULT '{}'::jsonb,

    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_position_history_device_id ON public.position_history(device_id);
CREATE INDEX IF NOT EXISTS idx_position_history_timestamp ON public.position_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_position_history_created_at ON public.position_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_position_history_location ON public.position_history(latitude, longitude);

-- 3. Updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS update_drone_captures_updated_at ON public.drone_captures;
CREATE TRIGGER update_drone_captures_updated_at
    BEFORE UPDATE ON public.drone_captures
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- RPC 함수 생성
-- ============================================

-- 1. 캡처 생성
CREATE OR REPLACE FUNCTION public.ah_create_capture(
    p_capture_id TEXT,
    p_device_id TEXT,
    p_timestamp TIMESTAMPTZ,
    p_stream_key TEXT,
    p_title TEXT,
    p_image_data TEXT,
    p_drone_data JSONB DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    p_description TEXT DEFAULT ''
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_id BIGINT;
BEGIN
    INSERT INTO public.drone_captures (
        capture_id,
        device_id,
        timestamp,
        stream_key,
        title,
        description,
        image_data,
        drone_lat,
        drone_lng,
        drone_alt,
        drone_heading,
        metadata,
        tags
    ) VALUES (
        p_capture_id,
        p_device_id,
        p_timestamp,
        p_stream_key,
        p_title,
        p_description,
        p_image_data,
        (p_drone_data->>'lat')::DOUBLE PRECISION,
        (p_drone_data->>'lng')::DOUBLE PRECISION,
        (p_drone_data->>'alt')::DOUBLE PRECISION,
        (p_drone_data->>'heading')::DOUBLE PRECISION,
        p_metadata,
        p_tags
    )
    RETURNING id INTO v_id;

    v_result = jsonb_build_object(
        'success', true,
        'capture_id', p_capture_id,
        'id', v_id
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 2. 캡처 목록 조회
CREATE OR REPLACE FUNCTION public.ah_get_captures(
    p_device_id TEXT DEFAULT NULL,
    p_stream_key TEXT DEFAULT NULL,
    p_limit INT DEFAULT 100,
    p_offset INT DEFAULT 0
)
RETURNS TABLE(
    capture_id TEXT,
    device_id TEXT,
    capture_timestamp TIMESTAMPTZ,
    stream_key TEXT,
    title TEXT,
    description TEXT,
    image_url TEXT,
    drone_lat DOUBLE PRECISION,
    drone_lng DOUBLE PRECISION,
    drone_alt DOUBLE PRECISION,
    drone_heading DOUBLE PRECISION,
    tags TEXT[],
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.capture_id,
        dc.device_id,
        dc.timestamp,
        dc.stream_key,
        dc.title,
        dc.description,
        dc.image_data as image_url,
        dc.drone_lat,
        dc.drone_lng,
        dc.drone_alt,
        dc.drone_heading,
        dc.tags,
        dc.created_at
    FROM public.drone_captures dc
    WHERE
        (p_device_id IS NULL OR dc.device_id = p_device_id)
        AND (p_stream_key IS NULL OR dc.stream_key = p_stream_key)
    ORDER BY dc.timestamp DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- 3. 캡처 삭제
CREATE OR REPLACE FUNCTION public.ah_delete_capture(
    p_capture_id TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_deleted_count INT;
BEGIN
    DELETE FROM public.drone_captures
    WHERE capture_id = p_capture_id;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', v_deleted_count > 0,
        'deleted_count', v_deleted_count
    );
END;
$$ LANGUAGE plpgsql;

-- 4. 위치 이력 저장
CREATE OR REPLACE FUNCTION public.ah_save_position_history(
    p_device_id TEXT,
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION,
    p_altitude DOUBLE PRECISION DEFAULT 0,
    p_speed DOUBLE PRECISION DEFAULT 0,
    p_heading DOUBLE PRECISION DEFAULT 0,
    p_battery_level INTEGER DEFAULT NULL,
    p_timestamp TIMESTAMPTZ DEFAULT NOW(),
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    v_id BIGINT;
BEGIN
    INSERT INTO public.position_history (
        device_id,
        latitude,
        longitude,
        altitude,
        speed,
        heading,
        battery_level,
        timestamp,
        metadata
    ) VALUES (
        p_device_id,
        p_latitude,
        p_longitude,
        p_altitude,
        p_speed,
        p_heading,
        p_battery_level,
        p_timestamp,
        p_metadata
    )
    RETURNING id INTO v_id;

    RETURN jsonb_build_object(
        'success', true,
        'id', v_id
    );
END;
$$ LANGUAGE plpgsql;

-- 5. 배치 캡처 생성
CREATE OR REPLACE FUNCTION public.ah_batch_create_captures(
    p_captures JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_capture JSONB;
    v_count INT := 0;
BEGIN
    FOR v_capture IN SELECT * FROM jsonb_array_elements(p_captures)
    LOOP
        INSERT INTO public.drone_captures (
            capture_id,
            device_id,
            timestamp,
            stream_key,
            title,
            description,
            image_data,
            drone_lat,
            drone_lng,
            drone_alt,
            drone_heading,
            tags
        ) VALUES (
            v_capture->>'id',
            v_capture->>'deviceId',
            (v_capture->>'timestamp')::TIMESTAMPTZ,
            v_capture->>'streamKey',
            v_capture->>'title',
            v_capture->>'description',
            v_capture->>'imageData',
            (v_capture->'droneData'->>'lat')::DOUBLE PRECISION,
            (v_capture->'droneData'->>'lng')::DOUBLE PRECISION,
            (v_capture->'droneData'->>'alt')::DOUBLE PRECISION,
            (v_capture->'droneData'->>'heading')::DOUBLE PRECISION,
            ARRAY(SELECT jsonb_array_elements_text(v_capture->'tags'))
        );
        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'count', v_count
    );
END;
$$ LANGUAGE plpgsql;

-- 6. 캡처 검색
CREATE OR REPLACE FUNCTION public.ah_search_captures(
    p_search_term TEXT DEFAULT NULL,
    p_tags TEXT[] DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL,
    p_is_public BOOLEAN DEFAULT NULL,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS TABLE(
    capture_id TEXT,
    device_id TEXT,
    capture_timestamp TIMESTAMPTZ,
    stream_key TEXT,
    title TEXT,
    description TEXT,
    tags TEXT[],
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.capture_id,
        dc.device_id,
        dc.timestamp,
        dc.stream_key,
        dc.title,
        dc.description,
        dc.tags,
        dc.created_at
    FROM public.drone_captures dc
    WHERE
        (p_search_term IS NULL OR
         dc.title ILIKE '%' || p_search_term || '%' OR
         dc.description ILIKE '%' || p_search_term || '%')
        AND (p_tags IS NULL OR dc.tags && p_tags)
        AND (p_start_date IS NULL OR dc.timestamp >= p_start_date)
        AND (p_end_date IS NULL OR dc.timestamp <= p_end_date)
        AND (p_is_public IS NULL OR dc.is_public = p_is_public)
    ORDER BY dc.timestamp DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- 7. 캡처 통계
CREATE OR REPLACE FUNCTION public.ah_get_capture_stats(
    p_device_id TEXT DEFAULT NULL,
    p_stream_key TEXT DEFAULT NULL,
    p_period_days INT DEFAULT 30
)
RETURNS JSONB AS $$
DECLARE
    v_stats JSONB;
    v_start_date TIMESTAMPTZ;
BEGIN
    v_start_date := NOW() - (p_period_days || ' days')::INTERVAL;

    SELECT jsonb_build_object(
        'total_captures', COUNT(*),
        'recent_captures', COUNT(*) FILTER (WHERE created_at >= v_start_date),
        'total_size_mb', ROUND(SUM(LENGTH(image_data)::NUMERIC / 1024 / 1024), 2),
        'popular_tags', (
            SELECT jsonb_agg(tag_info)
            FROM (
                SELECT jsonb_build_object(
                    'tag', tag,
                    'count', COUNT(*)
                ) as tag_info
                FROM public.drone_captures, unnest(tags) as tag
                WHERE
                    (p_device_id IS NULL OR device_id = p_device_id)
                    AND (p_stream_key IS NULL OR stream_key = p_stream_key)
                GROUP BY tag
                ORDER BY COUNT(*) DESC
                LIMIT 10
            ) t
        )
    ) INTO v_stats
    FROM public.drone_captures
    WHERE
        (p_device_id IS NULL OR device_id = p_device_id)
        AND (p_stream_key IS NULL OR stream_key = p_stream_key);

    RETURN v_stats;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Row Level Security (RLS) 설정
-- ============================================

-- RLS 활성화
ALTER TABLE public.drone_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.position_history ENABLE ROW LEVEL SECURITY;

-- 모든 사용자에게 읽기 권한 (개발 환경용)
CREATE POLICY "Enable read access for all users" ON public.drone_captures
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON public.drone_captures
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON public.drone_captures
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON public.drone_captures
    FOR DELETE USING (true);

-- Position History 정책
CREATE POLICY "Enable read access for all users" ON public.position_history
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON public.position_history
    FOR INSERT WITH CHECK (true);

-- ============================================
-- 완료
-- ============================================

-- 테이블 확인
SELECT
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('drone_captures', 'position_history');

-- 함수 확인
SELECT
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name LIKE 'ah_%'
ORDER BY routine_name;

-- Retrieval-only normalization: preserve original source text, math and citations.
BEGIN;
CREATE FUNCTION public.ai_tutor_search_text(p_text text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
 SELECT translate(regexp_replace(normalize(coalesce(p_text,''),NFKC),'[ًٌٍَُِّْٰـ]','','g'),'أإآٱى','ااااي');
$$;
REVOKE ALL ON FUNCTION public.ai_tutor_search_text(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ai_tutor_search_text(text) TO authenticated,service_role;
ALTER TABLE public.ai_tutor_chunks ADD COLUMN normalized_search tsvector
 GENERATED ALWAYS AS(to_tsvector('simple',public.ai_tutor_search_text(text))) STORED;
CREATE INDEX ai_tutor_normalized_search ON public.ai_tutor_chunks USING gin(normalized_search);
CREATE FUNCTION public.ai_tutor_search_query(p_query text) RETURNS tsquery
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
 SELECT to_tsquery('simple',coalesce(string_agg(quote_literal(token),' | '),'')) FROM (
  SELECT DISTINCT lower(token) AS token FROM regexp_split_to_table(public.ai_tutor_search_text(left(p_query,1500)),'[^[:alnum:]_]+') token
  WHERE length(token)>1 AND lower(token) NOT IN ('ما','هي','هو','اشرح','احسب','من','في','على','علي','عن','كيف','هل','هذه','هذا','لي','the','is','what','explain','calculate','a','an','of','in','to','how')
  ORDER BY token LIMIT 24
 ) terms;
$$;
REVOKE ALL ON FUNCTION public.ai_tutor_search_query(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ai_tutor_search_query(text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.search_ai_tutor(p_course uuid,p_query text,p_source uuid DEFAULT NULL,p_embedding real[] DEFAULT NULL,p_model text DEFAULT NULL)
RETURNS TABLE(id uuid,source_id uuid,revision uuid,title text,page integer,unit_id uuid,text text,score double precision)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH query AS (SELECT public.ai_tutor_search_query(p_query) AS terms), ranked AS(
 SELECT c.id,c.source_id,c.revision,s.title,c.page,c.unit_id,c.text,
 ts_rank_cd(c.normalized_search,q.terms)::double precision+
 CASE WHEN s.embedding_model=p_model AND cardinality(p_embedding)<=1536 THEN greatest(0,public.ai_tutor_cosine(c.embedding,p_embedding)-0.25) ELSE 0 END AS score
 FROM public.ai_tutor_chunks c JOIN public.ai_tutor_sources s ON s.id=c.source_id CROSS JOIN query q
 WHERE s.course_id=p_course AND (p_source IS NULL OR s.id=p_source) AND s.status='ready' AND s.revision=c.revision
 AND (c.normalized_search @@ q.terms OR (s.embedding_model=p_model AND cardinality(p_embedding)<=1536)))
 SELECT * FROM ranked WHERE score>0 ORDER BY score DESC,id LIMIT 6;
$$;
REVOKE ALL ON FUNCTION public.search_ai_tutor(uuid,text,uuid,real[],text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.search_ai_tutor(uuid,text,uuid,real[],text) TO authenticated;
COMMIT;

-- Y HUB: Restore course creation permission
-- Row Level Security continues to restrict course creation
-- to authorized users creating their own courses.

GRANT INSERT ON TABLE public.courses TO authenticated;

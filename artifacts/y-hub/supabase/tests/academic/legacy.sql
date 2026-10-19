-- Synthetic historical snapshot, applied BEFORE 0027 in the isolated container only.
INSERT INTO public.courses(id,instructor_id,title,course_code,is_published,enrollment_open)
VALUES ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Same title','SAME',true,true),
       ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000005','Same title','SAME',true,true);
INSERT INTO public.course_materials(id,course_id,title,type,url) VALUES('10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Material','link','https://example.invalid');
INSERT INTO public.exams(id,course_id,title,is_published) VALUES('10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','Exam',true);
INSERT INTO public.questions(id,course_id,exam_id,type,content,correct_answer) VALUES('10000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004','tf','Question','true');
INSERT INTO public.course_enrollments(course_id,student_id) VALUES('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004');
INSERT INTO public.student_results(exam_id,student_id,score,total_score) VALUES('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000004',1,1);
INSERT INTO public.syllabus_units(id,course_id,title) VALUES('10000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','Historical unit');
INSERT INTO public.syllabus_sections(id,unit_id,title) VALUES('10000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000006','Historical topic');
CREATE TABLE public.test_legacy_snapshot AS SELECT to_jsonb(c) AS row FROM public.courses c WHERE id::text LIKE '10000000%';

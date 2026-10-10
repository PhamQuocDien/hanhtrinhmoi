# University Architecture

Hierarchy:

`UniversityInstitution → Faculty → Field → DisciplineGroup → Major → Specialization → TrainingProgram(version) → Cohort → AcademicYear → Semester → Course → Topic → Lesson → Practice → Assessment`.

`TrainingProgram` và `Course` luôn gắn `institutionId`/`programId` khi là dữ liệu đại học, có version/status, sourceRef, learning outcomes, credits, prerequisites/co-requisites và category. Không có default curriculum dùng chung cho mọi trường. National/regulatory framework chỉ là một source/framework riêng; course curriculum của từng trường là source khác và không được trộn với K12.
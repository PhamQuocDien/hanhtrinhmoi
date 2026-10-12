# V6.1.1 — learning design and code execution references

This implementation borrows general educational patterns, not course text, question banks, screenshots, or proprietary assets from other platforms.

- **F8**: public course catalog and learning sequences suggest organizing lessons into progressive learning stages; the project uses a course → module → lesson structure with explanation, worked example, practice and project deliverables. Reference: https://f8.edu.vn/
- **CodeLearn**: programming learning and coding-exercise patterns inform the separation of coding lessons and executable practice. Reference: https://codelearn.io/
- **StudyVN Academy**: career-path packs with course collections, target roles, skills and estimated learning time inform the pathway → multiple courses model. Reference: https://studyvn.academy/pack/
- **PyViet**: multi-lesson Python learning structures inform tiered modules and progressively harder practice. Reference: https://pyviet.com/
- **Judge0 CE**: API supports sandboxed source execution, language identifiers, standard input/output, resource limits and detailed status. Reference: https://ce.judge0.com/

## Implementation shape

Each IT group has independent career pathways. Each course contains modules and lessons. A lesson has an objective, theory, example, practice, a deliverable and (where it calls for code) a language selector/starter program. C++, Java, C#, JavaScript, Python and SQL use Judge0 through the server API; HTML/CSS use a browser preview in a sandboxed iframe.

Generated questions default to inactive drafts. Group/course/module/lesson ids are stored with every question so a later assessment can draw only from the correct course scope. Human review is required before a course or generated question is activated for real learners.

## Scope and limitations

- Curriculum content is an original scaffold, not a claim that the platform is officially accredited or that university course codes represent the exact syllabus of every institution.
- Hosted judge services can throttle requests, change language versions or be unavailable. Production should use a secured, monitored runner.
- This version runs single-file console programs and basic SQL. Web framework projects, mobile device SDKs, multi-file projects and cloud infrastructure are practiced using guided labs/project artifacts rather than being falsely represented as runnable in the single-file judge.

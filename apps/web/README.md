# Web V5

Static HTML pages served by the Express API at the same origin. CSS and page-specific styles are in `src/css/`; browser-side API, auth, survey, dashboard and learning workflows are in `src/js/`. Learning catalog, progress, answer validation, grading decisions and authorization remain server-side. Do not put secrets or database logic in browser JavaScript.

'use strict';
const primary = require('./primary/primary-curriculum');
const lowerSecondary = require('./lower-secondary/lower-secondary-curriculum');
const highSchool = require('./high-school/high-school-curriculum');
const PROGRAMS = primary.PROGRAMS;
const SUBJECTS = { ...primary.SUBJECTS, ...lowerSecondary.SUBJECTS, ...highSchool.SUBJECTS };
function normalizeGrade(value) {
  const grade = Number(value);
  return Number.isInteger(grade) && grade >= 1 && grade <= 12 ? grade : null;
}
function normalizeProgram(code) { return primary.normalizeProgram(code); }
function subjectsForGrade(grade) {
  const safeGrade = normalizeGrade(grade);
  return !safeGrade ? [] : safeGrade <= 5 ? primary.subjectsForGrade(safeGrade) : safeGrade <= 9 ? lowerSecondary.subjectsForGrade(safeGrade) : highSchool.subjectsForGrade(safeGrade);
}
function buildCourse(grade, programCode, subjectCode) {
  const safeGrade = normalizeGrade(grade);
  return !safeGrade ? null : safeGrade <= 5 ? primary.buildCourse(safeGrade, programCode, subjectCode) : safeGrade <= 9 ? lowerSecondary.buildCourse(safeGrade, programCode, subjectCode) : highSchool.buildCourse(safeGrade, programCode, subjectCode);
}
function buildCatalog(grade, programCode) {
  const safeGrade = normalizeGrade(grade);
  return !safeGrade ? null : safeGrade <= 5 ? primary.buildCatalog(safeGrade, programCode) : safeGrade <= 9 ? lowerSecondary.buildCatalog(safeGrade, programCode) : highSchool.buildCatalog(safeGrade, programCode);
}
function findLesson(input) {
  const safeGrade = normalizeGrade(input?.grade);
  return !safeGrade ? null : safeGrade <= 5 ? primary.findLesson({ ...input, grade: safeGrade }) : safeGrade <= 9 ? lowerSecondary.findLesson({ ...input, grade: safeGrade }) : highSchool.findLesson({ ...input, grade: safeGrade });
}
function publicQuestion(question) { return primary.publicQuestion(question); }
function publicLesson(lesson) { return primary.publicLesson(lesson); }
function publicCourse(course) { return primary.publicCourse(course); }
module.exports = { PROGRAMS, SUBJECTS, subjectsForGrade, buildCourse, buildCatalog, findLesson, publicQuestion, publicLesson, publicCourse, normalizeGrade, normalizeProgram, isLowerSecondary: (grade) => Number(grade) >= 6 && Number(grade) <= 9, isHighSchool: (grade) => Number(grade) >= 10 && Number(grade) <= 12 };

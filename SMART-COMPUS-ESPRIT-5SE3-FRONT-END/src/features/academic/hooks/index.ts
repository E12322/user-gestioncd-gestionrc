import { useMemo } from "react";
import { useQuery } from "@/shared/api/useQuery";
import { useAuth } from "@/shared/auth/AuthContext";
import {
  getCourse,
  getCourseGrades,
  getMyGrades,
  getMyAbsences,
  listAbsences,
  getTimetable,
  listCourses,
  listEnrollments,
  type Viewer,
} from "../api";
import { AcademicService } from "../api/academicService";
import type { CourseFilters, AbsenceFilters } from "../types";

/** Identité de l'utilisateur courant, stable entre deux rendus. */
export function useViewer(): Viewer {
  const { user } = useAuth();
  return useMemo(() => ({ id: user.id, name: user.name, role: user.role }), [user.id, user.name, user.role]);
}

export function useCourses(filters: CourseFilters) {
  const viewer = useViewer();
  return useQuery((signal) => listCourses(filters, viewer, signal), [filters.q, filters.department, filters.teacherId, filters.teacherName, viewer.id]);
}

export function useCourse(id: string) {
  const viewer = useViewer();
  return useQuery((signal) => getCourse(id, viewer, signal), [id, viewer.id]);
}

export function useEnrollments() {
  const viewer = useViewer();
  return useQuery((signal) => listEnrollments(viewer, signal), [viewer.id, viewer.role]);
}

export function useTimetable() {
  const viewer = useViewer();
  return useQuery((signal) => getTimetable(viewer, signal), [viewer.id, viewer.role]);
}

export function useMyGrades() {
  const viewer = useViewer();
  return useQuery((signal) => getMyGrades(viewer, signal), [viewer.id]);
}

export function useCourseGrades(courseId: string) {
  const viewer = useViewer();
  return useQuery((signal) => getCourseGrades(courseId, viewer, signal), [courseId, viewer.id]);
}

export function useMyAbsences() {
  const viewer = useViewer();
  return useQuery((signal) => getMyAbsences(viewer, signal), [viewer.id]);
}

export function useAbsences(filters: AbsenceFilters) {
  const viewer = useViewer();
  return useQuery((signal) => listAbsences(filters, viewer, signal), [filters.courseId, filters.studentId, viewer.id]);
}

export function useBackendHealth() {
  return useQuery(async () => {
    return AcademicService.checkHealth();
  }, []);
}

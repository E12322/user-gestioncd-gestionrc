package tn.esprit.gestionetudiant.security;

import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;

import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Règles « propriétaire » : un étudiant ne lit que SES notes et SES absences ; enseignants et administrateurs lisent
 * celles de tous. L'identifiant numérique est dérivé du jeton comme dans {@code InscriptionController}
 * (sub « ETU-2026-0002 » → 20260002), c'est la convention des données de ce service.
 */
public final class AccessRules {

    private static final Pattern STUDENT_IN_PATH = Pattern.compile("/etudiant/(\\d+)(?:/|$)");

    private AccessRules() { }

    private static JwtAuthenticationFilter.JwtPrincipal principal(Authentication auth) {
        return auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof JwtAuthenticationFilter.JwtPrincipal p
                ? p : null;
    }

    private static boolean isStaff(JwtAuthenticationFilter.JwtPrincipal p) {
        return "admin".equalsIgnoreCase(p.role()) || "teacher".equalsIgnoreCase(p.role());
    }

    /** Identifiant numérique du compte (chiffres du sub), ou null s'il n'y en a pas. */
    public static Long numericId(JwtAuthenticationFilter.JwtPrincipal p) {
        if (p == null || p.id() == null) return null;
        String digits = p.id().replaceAll("\\D", "");
        if (digits.isEmpty()) return null;
        try {
            return Long.parseLong(digits);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static boolean isOwner(JwtAuthenticationFilter.JwtPrincipal p, String studentId) {
        Long mine = numericId(p);
        return mine != null && studentId != null && studentId.matches("\\d+") && mine.toString().equals(studentId);
    }

    /** /…/etudiant/{id}/… : l'étudiant concerné, ou le personnel. */
    public static AuthorizationDecision ownerOrStaffInPath(Supplier<Authentication> auth, RequestAuthorizationContext ctx) {
        var p = principal(auth.get());
        if (p == null) return new AuthorizationDecision(false);
        if (isStaff(p)) return new AuthorizationDecision(true);
        Matcher m = STUDENT_IN_PATH.matcher(ctx.getRequest().getRequestURI());
        return new AuthorizationDecision("student".equalsIgnoreCase(p.role()) && m.find() && isOwner(p, m.group(1)));
    }

    /** GET …/absences?etudiantId=N : le personnel, ou un étudiant qui demande SES absences (paramètre obligatoire). */
    public static AuthorizationDecision ownerOrStaffInQuery(Supplier<Authentication> auth, RequestAuthorizationContext ctx) {
        var p = principal(auth.get());
        if (p == null) return new AuthorizationDecision(false);
        if (isStaff(p)) return new AuthorizationDecision(true);
        return new AuthorizationDecision(
                "student".equalsIgnoreCase(p.role()) && isOwner(p, ctx.getRequest().getParameter("etudiantId")));
    }
}

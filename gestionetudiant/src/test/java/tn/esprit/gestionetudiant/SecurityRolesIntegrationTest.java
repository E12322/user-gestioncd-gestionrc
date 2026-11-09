package tn.esprit.gestionetudiant;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultMatcher;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.nio.charset.StandardCharsets;
import java.util.Date;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Autorisation par rôle du service académique. Avant ces règles, tout utilisateur connecté (étudiant compris)
 * pouvait supprimer un cours ou modifier des notes : seules 3 routes d'inscription vérifiaient un rôle.
 * Convention de test : « autorisé » = ni 401 ni 403 (le reste — 404, 400… — vient de la logique métier).
 */
@SpringBootTest
@AutoConfigureMockMvc
class SecurityRolesIntegrationTest {

    private static final String SECRET = "change-me-en-production-32-caracteres-minimum";
    private static final String ORIGIN = "http://localhost:5173";
    private static final String V1 = "/api/academic/v1";

    @Autowired
    MockMvc mvc;

    private static String token(String sub, String role, String secret, String issuer, String audience) throws Exception {
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject(sub).issuer(issuer).audience(audience)
                .claim("name", "Test " + role).claim("role", role)
                .expirationTime(new Date(System.currentTimeMillis() + 3_600_000)).build();
        SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
        jwt.sign(new MACSigner(secret.getBytes(StandardCharsets.UTF_8)));
        return jwt.serialize();
    }

    private static String token(String sub, String role) throws Exception {
        return token(sub, role, SECRET, "smartcampus-user-service", "smartcampus");
    }

    private static final String STUDENT = "ETU-2026-0002"; // identifiant numérique 20260002
    private static final String OTHER_STUDENT_ID = "20260003";

    private static MockHttpServletRequestBuilder asCookie(MockHttpServletRequestBuilder b, String t) {
        return b.cookie(new Cookie("sc_access", t)).header("X-Auth-Mode", "cookie").header("Origin", ORIGIN);
    }

    private static ResultMatcher allowed() {
        return result -> {
            int s = result.getResponse().getStatus();
            if (s == 401 || s == 403) throw new AssertionError("Accès refusé alors qu'il devait être autorisé : HTTP " + s);
        };
    }

    @Test
    void sansJetonToutEstRefuse() throws Exception {
        mvc.perform(get(V1 + "/courses")).andExpect(status().isUnauthorized());
        mvc.perform(delete(V1 + "/courses/999999")).andExpect(status().isUnauthorized());
    }

    @Test
    void unEtudiantNePeutRienModifierDuCatalogue() throws Exception {
        String t = token(STUDENT, "student");
        mvc.perform(asCookie(delete(V1 + "/courses/999999"), t)).andExpect(status().isForbidden());
        mvc.perform(asCookie(post(V1 + "/courses").contentType(MediaType.APPLICATION_JSON).content("{}"), t))
                .andExpect(status().isForbidden());
        mvc.perform(asCookie(put("/cours/1").contentType(MediaType.APPLICATION_JSON).content("{}"), t))
                .andExpect(status().isForbidden());
        for (String p : new String[]{"/groups", "/rooms", "/sessions", "/academic-years"}) {
            mvc.perform(asCookie(post(V1 + p).contentType(MediaType.APPLICATION_JSON).content("{}"), t))
                    .andExpect(status().isForbidden());
            mvc.perform(asCookie(delete(V1 + p + "/999999"), t)).andExpect(status().isForbidden());
        }
        mvc.perform(asCookie(post(V1 + "/planifications/emplois-du-temps").contentType(MediaType.APPLICATION_JSON).content("{}"), t))
                .andExpect(status().isForbidden());
    }

    @Test
    void unEtudiantNeSaisitNiNoteNiAbsenceNiFichier() throws Exception {
        String t = token(STUDENT, "student");
        mvc.perform(asCookie(post(V1 + "/evaluations/notes").contentType(MediaType.APPLICATION_JSON).content("{}"), t))
                .andExpect(status().isForbidden());
        mvc.perform(asCookie(put(V1 + "/evaluations/notes/1?valeur=20&enseignantId=1"), t)).andExpect(status().isForbidden());
        mvc.perform(asCookie(post(V1 + "/evaluations/absences").contentType(MediaType.APPLICATION_JSON).content("{}"), t))
                .andExpect(status().isForbidden());
        mvc.perform(asCookie(delete(V1 + "/evaluations/absences/1"), t)).andExpect(status().isForbidden());
        mvc.perform(asCookie(post(V1 + "/files/upload"), t)).andExpect(status().isForbidden());
    }

    @Test
    void unEtudiantLitLeCatalogueEtSesPropresNotes() throws Exception {
        String t = token(STUDENT, "student");
        mvc.perform(asCookie(get(V1 + "/courses"), t)).andExpect(status().isOk());
        mvc.perform(asCookie(get(V1 + "/evaluations/notes/etudiant/20260002"), t)).andExpect(allowed());
        mvc.perform(asCookie(get(V1 + "/evaluations/notes/etudiant/20260002/moyenne"), t)).andExpect(allowed());
        mvc.perform(asCookie(get(V1 + "/evaluations/absences/etudiant/20260002"), t)).andExpect(allowed());
        mvc.perform(asCookie(get(V1 + "/evaluations/absences").param("etudiantId", "20260002"), t)).andExpect(allowed());
    }

    @Test
    void unEtudiantNeLitPasLesNotesNiLesAbsencesDesAutres() throws Exception {
        String t = token(STUDENT, "student");
        mvc.perform(asCookie(get(V1 + "/evaluations/notes/etudiant/" + OTHER_STUDENT_ID), t)).andExpect(status().isForbidden());
        mvc.perform(asCookie(get(V1 + "/evaluations/notes/etudiant/" + OTHER_STUDENT_ID + "/moyenne"), t)).andExpect(status().isForbidden());
        mvc.perform(asCookie(get(V1 + "/evaluations/absences/etudiant/" + OTHER_STUDENT_ID), t)).andExpect(status().isForbidden());
        mvc.perform(asCookie(get(V1 + "/evaluations/absences").param("etudiantId", OTHER_STUDENT_ID), t)).andExpect(status().isForbidden());
        // Listes globales, et liste d'absences sans filtre : refusées.
        mvc.perform(asCookie(get(V1 + "/evaluations/absences"), t)).andExpect(status().isForbidden());
        mvc.perform(asCookie(get(V1 + "/evaluations/notes"), t)).andExpect(status().isForbidden());
        mvc.perform(asCookie(get(V1 + "/evaluations/notes/cours/1"), t)).andExpect(status().isForbidden());
        mvc.perform(asCookie(get("/evaluations/notes/etudiant/" + OTHER_STUDENT_ID), t)).andExpect(status().isForbidden());
    }

    @Test
    void unEnseignantSaisitLesNotesMaisNeTouchePasAuCatalogue() throws Exception {
        String t = token("ENS-2026-0007", "teacher");
        mvc.perform(asCookie(post(V1 + "/evaluations/notes").contentType(MediaType.APPLICATION_JSON).content("{}"), t))
                .andExpect(allowed());
        mvc.perform(asCookie(get(V1 + "/evaluations/notes/cours/1"), t)).andExpect(allowed());
        mvc.perform(asCookie(get(V1 + "/evaluations/notes/etudiant/" + OTHER_STUDENT_ID), t)).andExpect(allowed());
        mvc.perform(asCookie(delete(V1 + "/courses/999999"), t)).andExpect(status().isForbidden());
        mvc.perform(asCookie(post(V1 + "/groups").contentType(MediaType.APPLICATION_JSON).content("{}"), t))
                .andExpect(status().isForbidden());
    }

    @Test
    void unAdminPeutGererLeCatalogue() throws Exception {
        String t = token("ADM-2026-0002", "admin");
        mvc.perform(asCookie(delete(V1 + "/courses/999999"), t)).andExpect(status().isNotFound());
        mvc.perform(asCookie(get(V1 + "/evaluations/notes"), t)).andExpect(status().isOk());
        mvc.perform(asCookie(delete(V1 + "/groups/999999"), t)).andExpect(allowed());
    }

    @Test
    void uneEcritureParCookieExigeLEnTeteEtLOrigine() throws Exception {
        String t = token("ADM-2026-0002", "admin");
        mvc.perform(delete(V1 + "/courses/999999").cookie(new Cookie("sc_access", t)).header("Origin", ORIGIN))
                .andExpect(status().isForbidden());
        mvc.perform(delete(V1 + "/courses/999999").cookie(new Cookie("sc_access", t))
                .header("X-Auth-Mode", "cookie").header("Origin", "https://pirate.example")).andExpect(status().isForbidden());
        mvc.perform(delete(V1 + "/courses/999999").header("Authorization", "Bearer " + t)).andExpect(status().isNotFound());
    }

    @Test
    void unJetonFalsifieOuDUneAutreOrigineEstRefuse() throws Exception {
        String forge = token("ADM-1", "admin", "un-autre-secret-de-32-caracteres-minimum!", "smartcampus-user-service", "smartcampus");
        String autreAudience = token("ADM-1", "admin", SECRET, "smartcampus-user-service", "autre-application");
        String autreEmetteur = token("ADM-1", "admin", SECRET, "pirate", "smartcampus");
        for (String t : new String[]{forge, autreAudience, autreEmetteur}) {
            mvc.perform(get(V1 + "/courses").cookie(new Cookie("sc_access", t))).andExpect(status().isUnauthorized());
        }
    }

    @Test
    void leCorsRefuseLesSitesEtrangers() throws Exception {
        mvc.perform(options(V1 + "/courses").header("Origin", "https://pirate.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden());
        mvc.perform(options(V1 + "/courses").header("Origin", ORIGIN).header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk());
    }
}

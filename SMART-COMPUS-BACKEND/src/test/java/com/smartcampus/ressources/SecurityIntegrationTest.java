package com.smartcampus.ressources;

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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.nio.charset.StandardCharsets;
import java.util.Date;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Sécurité du service Ressources (jetons du user-service). Avant ces règles, le service n'exigeait aucune connexion,
 * le rôle et l'identité venaient d'en-têtes forgeables avec des valeurs par défaut.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SecurityIntegrationTest {

    private static final String SECRET = "change-me-en-production-32-caracteres-minimum";
    private static final String ORIGIN = "http://localhost:5173";

    @Autowired
    MockMvc mvc;

    private static String token(String sub, String name, String role, String secret, String audience) throws Exception {
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject(sub).issuer("smartcampus-user-service").audience(audience)
                .claim("name", name).claim("role", role)
                .expirationTime(new Date(System.currentTimeMillis() + 3_600_000)).build();
        SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
        jwt.sign(new MACSigner(secret.getBytes(StandardCharsets.UTF_8)));
        return jwt.serialize();
    }

    private static String token(String sub, String name, String role) throws Exception {
        return token(sub, name, role, SECRET, "smartcampus");
    }

    private static MockHttpServletRequestBuilder cookie(MockHttpServletRequestBuilder b, String token) {
        return b.cookie(new Cookie("sc_access", token));
    }

    /** Écriture comme le navigateur : cookie + X-Auth-Mode + Origin. */
    private static MockHttpServletRequestBuilder write(MockHttpServletRequestBuilder b, String token) {
        return cookie(b, token).header("X-Auth-Mode", "cookie").header("Origin", ORIGIN);
    }

    private static String body(String date, String purpose) {
        return "{\"roomId\":\"3\",\"date\":\"" + date + "\",\"start\":\"10:00\",\"end\":\"11:00\",\"attendees\":5,\"purpose\":\"" + purpose + "\"}";
    }

    private String createdId(MvcResult r) throws Exception {
        String json = r.getResponse().getContentAsString();
        return json.replaceAll(".*\"id\":\"(\\d+)\".*", "$1");
    }

    @Test
    void sansJetonToutEstRefuse() throws Exception {
        mvc.perform(get("/api/rooms")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/reservations")).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/reservations/1/status").contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"confirmed\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void lesEnTetesXUserSontIgnores() throws Exception {
        // Un enseignant qui se déclare admin dans un en-tête n'obtient rien.
        mvc.perform(put("/api/reservations/1/status").contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"confirmed\"}")
                        .header("X-User-Role", "admin").header("X-User-Id", "5"))
                .andExpect(status().isUnauthorized());
        mvc.perform(cookie(put("/api/reservations/1/status"), token("ENS-1", "Karim", "teacher"))
                        .header("X-User-Role", "admin").header("X-Auth-Mode", "cookie").header("Origin", ORIGIN)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"confirmed\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void toutUtilisateurConnectePeutLireLesSalles() throws Exception {
        for (String role : new String[]{"student", "teacher", "admin"}) {
            mvc.perform(cookie(get("/api/rooms"), token("U-" + role, "Test", role))).andExpect(status().isOk());
        }
    }

    @Test
    void unEtudiantNePeutPasReserver() throws Exception {
        mvc.perform(write(post("/api/reservations"), token("ETU-1", "Farah", "student"))
                        .contentType(MediaType.APPLICATION_JSON).content(body("2027-02-01", "x")))
                .andExpect(status().isForbidden());
    }

    @Test
    void uneReservationPrendLIdentiteDuJetonEtNonKarim() throws Exception {
        mvc.perform(write(post("/api/reservations"), token("ENS-9", "Amina Benali", "teacher"))
                        .contentType(MediaType.APPLICATION_JSON).content(body("2027-02-02", "Cours de test")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.requesterName").value("Amina Benali"))
                .andExpect(jsonPath("$.status").value("pending"));
    }

    @Test
    void uneEcritureParCookieSansEnTeteCsrfEstRefusee() throws Exception {
        String t = token("ENS-9", "Amina Benali", "teacher");
        mvc.perform(cookie(post("/api/reservations"), t).header("Origin", ORIGIN)
                        .contentType(MediaType.APPLICATION_JSON).content(body("2027-02-03", "x")))
                .andExpect(status().isForbidden());
        mvc.perform(cookie(post("/api/reservations"), t).header("X-Auth-Mode", "cookie").header("Origin", "https://pirate.example")
                        .contentType(MediaType.APPLICATION_JSON).content(body("2027-02-03", "x")))
                .andExpect(status().isForbidden());
    }

    @Test
    void unBearerEcritSansEnTeteCsrf() throws Exception {
        mvc.perform(post("/api/reservations").header("Authorization", "Bearer " + token("ENS-9", "Amina Benali", "teacher"))
                        .contentType(MediaType.APPLICATION_JSON).content(body("2027-02-04", "via bearer")))
                .andExpect(status().isCreated());
    }

    @Test
    void seulUnAdminDecideEtLesAutresVoientSeulementLeurs() throws Exception {
        String ens = token("ENS-77", "Prof Sept", "teacher");
        String adm = token("ADM-1", "Admin", "admin");
        MvcResult created = mvc.perform(write(post("/api/reservations"), ens)
                        .contentType(MediaType.APPLICATION_JSON).content(body("2027-02-05", "a valider")))
                .andExpect(status().isCreated()).andReturn();
        String id = createdId(created);

        // L'enseignant ne peut ni valider ni voir « toutes » les réservations.
        mvc.perform(write(put("/api/reservations/" + id + "/status"), ens)
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"confirmed\"}")).andExpect(status().isForbidden());
        mvc.perform(cookie(get("/api/reservations?scope=all"), ens)).andExpect(status().isForbidden());
        mvc.perform(cookie(get("/api/reservations"), ens)).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].requesterName").value("Prof Sept"));

        // L'admin voit tout et peut valider.
        mvc.perform(cookie(get("/api/reservations?scope=all"), adm)).andExpect(status().isOk())
                .andExpect(content().string(containsString("a valider")));
        mvc.perform(write(put("/api/reservations/" + id + "/status"), adm)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"confirmed\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("confirmed"));
    }

    @Test
    void onNeAnnuleQueSaPropreReservation() throws Exception {
        MvcResult created = mvc.perform(write(post("/api/reservations"), token("ENS-A", "Prof A", "teacher"))
                        .contentType(MediaType.APPLICATION_JSON).content(body("2027-02-06", "de A")))
                .andExpect(status().isCreated()).andReturn();
        String id = createdId(created);
        mvc.perform(write(delete("/api/reservations/" + id), token("ENS-B", "Prof B", "teacher"))).andExpect(status().isForbidden());
        mvc.perform(write(delete("/api/reservations/" + id), token("ENS-A", "Prof A", "teacher"))).andExpect(status().isNoContent());
    }

    @Test
    void unJetonFalsifieOuDUneAutreAudienceEstRefuse() throws Exception {
        String forge = token("ADM-1", "Pirate", "admin", "un-autre-secret-de-32-caracteres-minimum!", "smartcampus");
        String autreAudience = token("ADM-1", "Admin", "admin", SECRET, "autre-application");
        mvc.perform(cookie(get("/api/rooms"), forge)).andExpect(status().isUnauthorized());
        mvc.perform(cookie(get("/api/rooms"), autreAudience)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/rooms").header("Authorization", "Bearer pas.un.jwt")).andExpect(status().isUnauthorized());
    }

    @Test
    void lApiInterneEstReserveALAdmin() throws Exception {
        mvc.perform(cookie(get("/api/internal/salles"), token("ENS-1", "Prof", "teacher"))).andExpect(status().isForbidden());
        mvc.perform(cookie(get("/api/internal/salles"), token("ADM-1", "Admin", "admin"))).andExpect(status().isOk());
        mvc.perform(cookie(get("/api/interventions"), token("ENS-1", "Prof", "teacher"))).andExpect(status().isForbidden());
        mvc.perform(cookie(get("/api/rooms"), token("ENS-1", "Prof", "teacher")))
                .andExpect(content().string(not(containsString("secret"))));
    }
}

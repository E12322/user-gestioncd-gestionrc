package tn.esprit.gestionetudiant;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/** Vérifie que le contexte Spring démarre sur le profil de test (H2 en mémoire). */
@SpringBootTest
@ActiveProfiles("test")
class GestionetudiantApplicationTests {

    @Test
    void contextLoads() {
    }

}

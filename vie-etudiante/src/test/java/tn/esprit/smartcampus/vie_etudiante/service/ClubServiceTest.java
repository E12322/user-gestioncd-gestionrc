package tn.esprit.smartcampus.vie_etudiante.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpStatus;
import tn.esprit.smartcampus.vie_etudiante.dto.ClubInputDTO;
import tn.esprit.smartcampus.vie_etudiante.exception.ApiException;
import tn.esprit.smartcampus.vie_etudiante.model.Club;
import tn.esprit.smartcampus.vie_etudiante.repository.ClubRepository;
import tn.esprit.smartcampus.vie_etudiante.repository.EventRepository;
import tn.esprit.smartcampus.vie_etudiante.repository.MembershipRepository;
import tn.esprit.smartcampus.vie_etudiante.security.JwtPrincipal;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ClubServiceTest {

    @Mock
    private ClubRepository clubRepository;

    @Mock
    private MembershipRepository membershipRepository;

    @Mock
    private EventRepository eventRepository;

    @Mock
    private MongoTemplate mongoTemplate;

    @InjectMocks
    private ClubService clubService;

    private JwtPrincipal adminViewer;
    private JwtPrincipal studentViewer;

    @BeforeEach
    void setUp() {
        adminViewer = new JwtPrincipal("ADM-001", "Admin Test", "admin", null);
        studentViewer = new JwtPrincipal("ETU-001", "Etudiant Test", "student", null);
    }

    @Test
    @DisplayName("Créer un club : refusé si l'utilisateur n'est pas administrateur (403)")
    void createClub_nonAdmin_forbidden() {
        ClubInputDTO input = ClubInputDTO.builder()
                .name("Club IA")
                .category("Technologie")
                .description("Test description")
                .meetingPlace("Bloc B")
                .maxMembers(30)
                .build();

        ApiException ex = assertThrows(ApiException.class, () -> clubService.createClub(input, studentViewer));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
        assertEquals("FORBIDDEN", ex.getCode());
    }

    @Test
    @DisplayName("Créer un club : conflit si le nom existe déjà (409 CLUB_EXISTS)")
    void createClub_nameExists_conflict() {
        ClubInputDTO input = ClubInputDTO.builder()
                .name("Club Robotique")
                .category("Technologie")
                .description("Test description")
                .meetingPlace("Bloc B")
                .maxMembers(30)
                .build();

        when(clubRepository.existsByNameIgnoreCase("Club Robotique")).thenReturn(true);

        ApiException ex = assertThrows(ApiException.class, () -> clubService.createClub(input, adminViewer));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertEquals("CLUB_EXISTS", ex.getCode());
    }

    @Test
    @DisplayName("Créer un club : succès pour l'administrateur avec nom unique (201)")
    void createClub_success() {
        ClubInputDTO input = ClubInputDTO.builder()
                .name("Club Musique")
                .category("Arts")
                .description("Musique et chant")
                .meetingPlace("Amphi C")
                .maxMembers(25)
                .build();

        when(clubRepository.existsByNameIgnoreCase("Club Musique")).thenReturn(false);
        when(clubRepository.save(any(Club.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Club created = clubService.createClub(input, adminViewer);
        assertNotNull(created);
        assertEquals("Club Musique", created.getName());
        assertEquals(0, created.getMembers());
        assertEquals(25, created.getMaxMembers());
        verify(clubRepository).save(any(Club.class));
    }

    @Test
    @DisplayName("Consulter un club inexistant : 404 CLUB_NOT_FOUND")
    void getClub_notFound() {
        when(clubRepository.findById("k999")).thenReturn(Optional.empty());

        ApiException ex = assertThrows(ApiException.class, () -> clubService.getClub("k999", studentViewer));
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatus());
        assertEquals("CLUB_NOT_FOUND", ex.getCode());
    }
}

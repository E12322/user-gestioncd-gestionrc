package tn.esprit.smartcampus.vie_etudiante.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import tn.esprit.smartcampus.vie_etudiante.exception.ApiException;
import tn.esprit.smartcampus.vie_etudiante.model.Club;
import tn.esprit.smartcampus.vie_etudiante.model.Membership;
import tn.esprit.smartcampus.vie_etudiante.repository.ClubRepository;
import tn.esprit.smartcampus.vie_etudiante.repository.MembershipRepository;
import tn.esprit.smartcampus.vie_etudiante.security.JwtPrincipal;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MembershipServiceTest {

    @Mock
    private MembershipRepository membershipRepository;

    @Mock
    private ClubRepository clubRepository;

    @InjectMocks
    private MembershipService membershipService;

    private JwtPrincipal adminViewer;
    private JwtPrincipal studentViewer;
    private Club openClub;
    private Club fullClub;

    @BeforeEach
    void setUp() {
        adminViewer = new JwtPrincipal("ADM-001", "Admin", "admin", null);
        studentViewer = new JwtPrincipal("ETU-001", "Yasmine", "student", null);

        openClub = Club.builder().id("k1").name("Club Robotique").members(10).maxMembers(20).build();
        fullClub = Club.builder().id("k2").name("Club Théâtre").members(30).maxMembers(30).build();
    }

    @Test
    @DisplayName("Adhésion : refusée à l'administrateur (403)")
    void requestMembership_admin_forbidden() {
        ApiException ex = assertThrows(ApiException.class, () -> membershipService.requestMembership("k1", adminViewer));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
    }

    @Test
    @DisplayName("Adhésion : refusée si le club est complet (409 CLUB_FULL)")
    void requestMembership_clubFull_conflict() {
        when(clubRepository.findById("k2")).thenReturn(Optional.of(fullClub));
        when(membershipRepository.findByClubIdAndMemberId("k2", "ETU-001")).thenReturn(Optional.empty());

        ApiException ex = assertThrows(ApiException.class, () -> membershipService.requestMembership("k2", studentViewer));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertEquals("CLUB_FULL", ex.getCode());
    }

    @Test
    @DisplayName("Adhésion : refusée si l'étudiant a déjà une demande en attente (409 ALREADY_MEMBER)")
    void requestMembership_alreadyMember_conflict() {
        Membership existing = Membership.builder().id("m-1").status("pending").build();
        when(clubRepository.findById("k1")).thenReturn(Optional.of(openClub));
        when(membershipRepository.findByClubIdAndMemberId("k1", "ETU-001")).thenReturn(Optional.of(existing));

        ApiException ex = assertThrows(ApiException.class, () -> membershipService.requestMembership("k1", studentViewer));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertEquals("ALREADY_MEMBER", ex.getCode());
    }

    @Test
    @DisplayName("Adhésion : succès pour l'étudiant (création avec statut pending)")
    void requestMembership_success() {
        when(clubRepository.findById("k1")).thenReturn(Optional.of(openClub));
        when(membershipRepository.findByClubIdAndMemberId("k1", "ETU-001")).thenReturn(Optional.empty());
        when(membershipRepository.save(any(Membership.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Membership created = membershipService.requestMembership("k1", studentViewer);
        assertNotNull(created);
        assertEquals("pending", created.getStatus());
        assertEquals("ETU-001", created.getMemberId());
        assertEquals("k1", created.getClubId());
        verify(membershipRepository).save(any(Membership.class));
    }
}

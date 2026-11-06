package tn.esprit.gestionetudiant.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tn.esprit.gestionetudiant.dto.InscriptionResponseDTO;
import tn.esprit.gestionetudiant.entity.Cours;
import tn.esprit.gestionetudiant.entity.Inscription;
import tn.esprit.gestionetudiant.entity.Seance;
import tn.esprit.gestionetudiant.event.InscriptionCreeeEvent;
import tn.esprit.gestionetudiant.exception.BusinessException;
import tn.esprit.gestionetudiant.exception.ConflictException;
import tn.esprit.gestionetudiant.exception.ResourceNotFoundException;
import tn.esprit.gestionetudiant.repository.CoursRepository;
import tn.esprit.gestionetudiant.repository.InscriptionRepository;
import tn.esprit.gestionetudiant.repository.SeanceRepository;
import tn.esprit.gestionetudiant.service.IInscriptionService;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class InscriptionServiceImpl implements IInscriptionService {

    private final InscriptionRepository inscriptionRepository;
    private final CoursRepository coursRepository;
    private final SeanceRepository seanceRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    @Transactional
    public InscriptionResponseDTO demander(Long coursId, Long etudiantId) {
        Cours cours = coursRepository.findById(coursId)
                .orElseThrow(() -> new ResourceNotFoundException("Cours non trouvé avec l'id : " + coursId));

        // Règle mixte : Seuls les cours OPTIONNELS sont ouverts à l'inscription libre
        boolean isOptionnel = "OPTIONNEL".equalsIgnoreCase(cours.getNature());
        if (!isOptionnel) {
            throw new ConflictException("Ce cours est obligatoire et fait l'objet d'une affectation directe par groupe. L'inscription libre est réservée aux cours optionnels.");
        }

        // Capacité : places occupées par les inscriptions validées
        long occupees = inscriptionRepository.countByCoursIdAndStatut(coursId, Inscription.STATUT_VALIDEE);
        if (cours.getCapacite() != null && occupees >= cours.getCapacite()) {
            throw new ConflictException("Ce cours est complet (" + occupees + "/" + cours.getCapacite()
                    + " places occupées)");
        }

        // Contrôle de chevauchement d'horaire avec les cours déjà validés de l'étudiant
        List<Inscription> valides = inscriptionRepository.findByEtudiantIdAndStatut(etudiantId, Inscription.STATUT_VALIDEE);
        if (!valides.isEmpty()) {
            List<Long> studentCoursIds = valides.stream().map(Inscription::getCoursId).toList();
            List<Seance> studentSeances = seanceRepository.findByCoursIdIn(studentCoursIds);
            List<Seance> targetSeances = seanceRepository.findByCoursId(coursId);

            for (Seance ts : targetSeances) {
                for (Seance ss : studentSeances) {
                    if (ts.getJour() != null && ts.getJour().equals(ss.getJour())
                            && ts.getHeureDebut() != null && ts.getHeureFin() != null
                            && ss.getHeureDebut() != null && ss.getHeureFin() != null) {
                        if (ts.getHeureDebut().isBefore(ss.getHeureFin()) && ts.getHeureFin().isAfter(ss.getHeureDebut())) {
                            String coursConflit = ss.getCours() != null ? ss.getCours().getIntitule() : "autre cours";
                            throw new ConflictException("Chevauchement d'horaire : conflit avec votre cours « "
                                    + coursConflit + " » le jour " + ts.getJour() + " de " + ts.getHeureDebut() + " à " + ts.getHeureFin() + ".");
                        }
                    }
                }
            }
        }

        // Réutilisation de la ligne existante si présente (contrainte unique cours_id + etudiant_id)
        Optional<Inscription> existingOpt = inscriptionRepository.findByCoursIdAndEtudiantId(coursId, etudiantId);
        if (existingOpt.isPresent()) {
            Inscription existing = existingOpt.get();
            if (Inscription.STATUT_VALIDEE.equals(existing.getStatut())) {
                throw new ConflictException("Vous êtes déjà inscrit à ce cours");
            }
            if (Inscription.STATUT_EN_ATTENTE.equals(existing.getStatut())) {
                throw new ConflictException("Vous avez déjà une demande en attente pour ce cours");
            }
            // Réutilisation après refus
            existing.setStatut(Inscription.STATUT_EN_ATTENTE);
            existing.setSource(Inscription.SOURCE_LIBRE);
            existing.setGroupeId(null);
            existing.setDateDemande(Instant.now());
            existing.setDateDecision(null);
            Inscription saved = inscriptionRepository.save(existing);
            eventPublisher.publishEvent(new InscriptionCreeeEvent(saved.getId(), coursId, etudiantId, Inscription.SOURCE_LIBRE, Inscription.STATUT_EN_ATTENTE, null));
            return toDTO(saved);
        }

        // Nouvelle inscription libre
        Inscription inscription = new Inscription();
        inscription.setCoursId(coursId);
        inscription.setEtudiantId(etudiantId);
        inscription.setStatut(Inscription.STATUT_EN_ATTENTE);
        inscription.setSource(Inscription.SOURCE_LIBRE);
        inscription.setGroupeId(null);
        inscription.setDateDemande(Instant.now());
        Inscription saved = inscriptionRepository.save(inscription);
        eventPublisher.publishEvent(new InscriptionCreeeEvent(saved.getId(), coursId, etudiantId, Inscription.SOURCE_LIBRE, Inscription.STATUT_EN_ATTENTE, null));
        return toDTO(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<InscriptionResponseDTO> lister(Long etudiantId, Long coursId) {
        List<Inscription> inscriptions;
        if (etudiantId != null) {
            inscriptions = inscriptionRepository.findByEtudiantIdOrderByDateDemandeDesc(etudiantId);
        } else if (coursId != null) {
            inscriptions = inscriptionRepository.findByCoursIdOrderByDateDemandeDesc(coursId);
        } else {
            inscriptions = inscriptionRepository.findAllByOrderByDateDemandeDesc();
        }
        return inscriptions.stream()
                .filter(i -> coursId == null || coursId.equals(i.getCoursId()))
                .map(InscriptionServiceImpl::toDTO)
                .toList();
    }

    @Override
    @Transactional
    public InscriptionResponseDTO decider(Long inscriptionId, String statut) {
        if (!Inscription.STATUT_VALIDEE.equals(statut) && !Inscription.STATUT_REFUSEE.equals(statut)) {
            throw new BusinessException("Statut inconnu : " + statut + " (attendu : validated ou refused)");
        }
        Inscription inscription = inscriptionRepository.findById(inscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("Inscription introuvable avec l'id : " + inscriptionId));

        if (!Inscription.STATUT_EN_ATTENTE.equals(inscription.getStatut())) {
            throw new ConflictException("Cette demande a déjà été traitée (" + inscription.getStatut() + ")");
        }

        // Passage à "validated" : vérifier la capacité résiduelle
        if (Inscription.STATUT_VALIDEE.equals(statut)) {
            long occupees = inscriptionRepository.countByCoursIdAndStatut(inscription.getCoursId(), Inscription.STATUT_VALIDEE);
            Cours cours = coursRepository.findById(inscription.getCoursId()).orElse(null);
            if (cours != null && cours.getCapacite() != null && occupees >= cours.getCapacite()) {
                throw new ConflictException("Ce cours est complet (" + occupees + "/" + cours.getCapacite() + " places occupées)");
            }
        }

        inscription.setStatut(statut);
        inscription.setDateDecision(Instant.now());
        Inscription saved = inscriptionRepository.save(inscription);
        if (Inscription.STATUT_VALIDEE.equals(statut)) {
            eventPublisher.publishEvent(new InscriptionCreeeEvent(saved.getId(), saved.getCoursId(), saved.getEtudiantId(), saved.getSource(), Inscription.STATUT_VALIDEE, saved.getGroupeId()));
        }
        return toDTO(saved);
    }

    private static InscriptionResponseDTO toDTO(Inscription i) {
        return new InscriptionResponseDTO(
                i.getId(), i.getCoursId(), i.getEtudiantId(), i.getStatut(),
                i.getSource(), i.getGroupeId(),
                i.getDateDemande(), i.getDateDecision());
    }
}

package tn.esprit.gestionetudiant.service.impl;

import lombok.AllArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tn.esprit.gestionetudiant.dto.AbsenceRequestDTO;
import tn.esprit.gestionetudiant.dto.AbsenceResponseDTO;
import tn.esprit.gestionetudiant.dto.NoteRequestDTO;
import tn.esprit.gestionetudiant.dto.NoteResponseDTO;
import tn.esprit.gestionetudiant.entity.Absence;
import tn.esprit.gestionetudiant.entity.Cours;
import tn.esprit.gestionetudiant.entity.Note;
import tn.esprit.gestionetudiant.exception.BusinessException;
import tn.esprit.gestionetudiant.exception.ResourceNotFoundException;
import tn.esprit.gestionetudiant.repository.AbsenceRepository;
import tn.esprit.gestionetudiant.repository.CoursRepository;
import tn.esprit.gestionetudiant.repository.NoteRepository;
import tn.esprit.gestionetudiant.service.IAuthentification;
import tn.esprit.gestionetudiant.service.IEvaluation;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;
@AllArgsConstructor
@Service
public class EvaluationServiceImpl implements IEvaluation {

    private static final Logger log = LoggerFactory.getLogger(EvaluationServiceImpl.class);
    private static final int SEUIL_ABSENCES_MAX = 3;

    // Faible couplage : injection via l'interface IAuthentification (microservice Utilisateurs)
    private final IAuthentification authentificationService;
    private final NoteRepository noteRepository;
    private final AbsenceRepository absenceRepository;
    private final CoursRepository coursRepository;

    @Override
    @Transactional
    public NoteResponseDTO saisirNote(NoteRequestDTO request) {
        // Règle métier : IEvaluation dépend de «IAuthentification» pour vérifier le rôle enseignant
        if (!authentificationService.verifierRoleEnseignant(request.getEnseignantId())) {
            throw new BusinessException("Règle métier : Seul un utilisateur avec le rôle ENSEIGNANT peut saisir une note.");
        }

        // Règle métier : note ∈ [0, 20]
        if (request.getValeur() < 0.0f || request.getValeur() > 20.0f) {
            throw new BusinessException("Règle métier : La note doit être comprise dans l'intervalle [0, 20]. Valeur fournie: " + request.getValeur());
        }

        Cours cours = coursRepository.findById(request.getCoursId())
                .orElseThrow(() -> new ResourceNotFoundException("Cours non trouvé avec l'id : " + request.getCoursId()));

        Note note = noteRepository.findByEtudiantIdAndCoursId(request.getEtudiantId(), request.getCoursId())
                .orElseGet(() -> {
                    Note nouvelleNote = new Note();
                    nouvelleNote.setEtudiantId(request.getEtudiantId());
                    nouvelleNote.setCours(cours);
                    return nouvelleNote;
                });

        note.setValeur(request.getValeur());
        Note savedNote = noteRepository.save(note);

        return mapToNoteResponse(savedNote);
    }

    @Override
    @Transactional
    public NoteResponseDTO modifierNote(Long noteId, float nouvelleValeur, Long enseignantId) {
        // Règle métier : Vérification rôle enseignant auprès de IAuthentification
        if (!authentificationService.verifierRoleEnseignant(enseignantId)) {
            throw new BusinessException("Règle métier : Seul un enseignant est autorisé à modifier une note.");
        }

        // Règle métier : note ∈ [0, 20]
        if (nouvelleValeur < 0.0f || nouvelleValeur > 20.0f) {
            throw new BusinessException("Règle métier : La note doit être comprise dans l'intervalle [0, 20].");
        }

        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new ResourceNotFoundException("Note non trouvée avec l'id : " + noteId));

        note.setValeur(nouvelleValeur);
        Note updatedNote = noteRepository.save(note);
        return mapToNoteResponse(updatedNote);
    }

    @Override
    @Transactional(readOnly = true)
    public List<NoteResponseDTO> consulterNotes(Long etudiantId) {
        return noteRepository.findByEtudiantId(etudiantId)
                .stream()
                .map(this::mapToNoteResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<NoteResponseDTO> consulterNotesParCours(Long coursId) {
        if (!coursRepository.existsById(coursId)) {
            throw new ResourceNotFoundException("Cours non trouvé avec l'id : " + coursId);
        }
        return noteRepository.findByCoursId(coursId)
                .stream()
                .map(this::mapToNoteResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<NoteResponseDTO> listerToutesNotes() {
        return noteRepository.findAll()
                .stream()
                .map(this::mapToNoteResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public float calculerMoyenne(Long etudiantId) {
        Double moyenne = noteRepository.calculateMoyenneByEtudiantId(etudiantId);
        return moyenne != null ? moyenne.floatValue() : 0.0f;
    }

    @Override
    @Transactional
    public AbsenceResponseDTO enregistrerAbsence(AbsenceRequestDTO request) {
        // Règle métier : IEvaluation dépend de «IAuthentification» pour vérifier le rôle enseignant
        if (!authentificationService.verifierRoleEnseignant(request.getEnseignantId())) {
            throw new BusinessException("Règle métier : Seul un utilisateur avec le rôle ENSEIGNANT peut enregistrer une absence.");
        }

        // Règle métier : Une absence ne peut pas être enregistrée deux fois pour la même séance et la même date
        LocalDate date = request.getDateAbsence() != null ? request.getDateAbsence() : LocalDate.now();
        List<Absence> existantes = absenceRepository.findByEtudiantIdAndCoursId(request.getEtudiantId(), request.getCoursId());
        Absence duplicate = existantes.stream()
                .filter(a -> request.getSeance().equalsIgnoreCase(a.getSeance()) && date.equals(a.getDateAbsence()))
                .findFirst()
                .orElse(null);
        if (duplicate != null) {
            duplicate.setJustifiee(request.isJustifiee());
            Absence saved = absenceRepository.save(duplicate);
            return mapToAbsenceResponse(saved);
        }

        Cours cours = coursRepository.findById(request.getCoursId())
                .orElseThrow(() -> new ResourceNotFoundException("Cours non trouvé avec l'id : " + request.getCoursId()));

        Absence absence = new Absence();
        absence.setEtudiantId(request.getEtudiantId());
        absence.setCours(cours);
        absence.setSeance(request.getSeance());
        absence.setDateAbsence(date);
        absence.setJustifiee(request.isJustifiee());

        Absence savedAbsence = absenceRepository.save(absence);

        long totalAbsences = absenceRepository.countByEtudiantIdAndCoursId(request.getEtudiantId(), request.getCoursId());
        boolean seuilDepasse = totalAbsences >= SEUIL_ABSENCES_MAX;
        String notification = null;

        if (seuilDepasse) {
            notification = "ATTENTION : L'étudiant ID " + request.getEtudiantId() +
                    " a dépassé le seuil d'absences autorisé (" + totalAbsences + " absences) pour le cours " + cours.getIntitule();
            log.warn(notification);
        }

        AbsenceResponseDTO response = new AbsenceResponseDTO();
        response.setId(savedAbsence.getId());
        response.setSeance(savedAbsence.getSeance());
        response.setDateAbsence(savedAbsence.getDateAbsence());
        response.setJustifiee(savedAbsence.isJustifiee());
        response.setEtudiantId(savedAbsence.getEtudiantId());
        response.setEtudiantNom("Etudiant #" + savedAbsence.getEtudiantId());
        response.setCoursId(cours.getId());
        response.setCoursIntitule(cours.getIntitule());
        response.setTotalAbsencesCours(totalAbsences);
        response.setSeuilDepasse(seuilDepasse);
        response.setMessageNotification(notification);
        return response;
    }

    @Override
    @Transactional(readOnly = true)
    public List<AbsenceResponseDTO> consulterAbsences(Long etudiantId) {
        return absenceRepository.findByEtudiantId(etudiantId)
                .stream()
                .map(this::mapToAbsenceResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<AbsenceResponseDTO> listerAbsences(Long coursId, Long etudiantId) {
        List<Absence> absences;
        if (coursId != null && etudiantId != null) {
            absences = absenceRepository.findByEtudiantIdAndCoursId(etudiantId, coursId);
        } else if (coursId != null) {
            absences = absenceRepository.findByCoursId(coursId);
        } else if (etudiantId != null) {
            absences = absenceRepository.findByEtudiantId(etudiantId);
        } else {
            absences = absenceRepository.findAll();
        }
        return absences.stream()
                .map(this::mapToAbsenceResponse)
                .collect(Collectors.toList());
    }

    /** DTO d'absence enrichi du total par cours (pour le seuil d'alerte). */
    private AbsenceResponseDTO mapToAbsenceResponse(Absence abs) {
        Long coursId = abs.getCours() != null ? abs.getCours().getId() : null;
        long total = (abs.getEtudiantId() != null && coursId != null)
                ? absenceRepository.countByEtudiantIdAndCoursId(abs.getEtudiantId(), coursId)
                : 0L;
        AbsenceResponseDTO dto = new AbsenceResponseDTO();
        dto.setId(abs.getId());
        dto.setSeance(abs.getSeance());
        dto.setDateAbsence(abs.getDateAbsence());
        dto.setJustifiee(abs.isJustifiee());
        dto.setEtudiantId(abs.getEtudiantId());
        dto.setEtudiantNom("Etudiant #" + abs.getEtudiantId());
        dto.setCoursId(coursId);
        dto.setCoursIntitule(abs.getCours() != null ? abs.getCours().getIntitule() : null);
        dto.setTotalAbsencesCours(total);
        dto.setSeuilDepasse(total >= SEUIL_ABSENCES_MAX);
        return dto;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean notifierSeuilDepasse(Long etudiantId, Long coursId) {
        long total = absenceRepository.countByEtudiantIdAndCoursId(etudiantId, coursId);
        return total >= SEUIL_ABSENCES_MAX;
    }

    @Override
    @Transactional
    public void supprimerAbsence(Long id) {
        if (absenceRepository.existsById(id)) {
            absenceRepository.deleteById(id);
        }
    }

    @Override
    @Transactional
    public AbsenceResponseDTO justifierAbsence(Long id, boolean justifiee) {
        Absence abs = absenceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Absence non trouvée avec l'id : " + id));
        abs.setJustifiee(justifiee);
        return mapToAbsenceResponse(absenceRepository.save(abs));
    }

    private NoteResponseDTO mapToNoteResponse(Note note) {
        NoteResponseDTO dto = new NoteResponseDTO();
        dto.setId(note.getId());
        dto.setValeur(note.getValeur());
        dto.setEtudiantId(note.getEtudiantId());
        dto.setEtudiantNom("Etudiant #" + note.getEtudiantId());
        dto.setCoursId(note.getCours().getId());
        dto.setCoursIntitule(note.getCours().getIntitule());
        return dto;
    }
}

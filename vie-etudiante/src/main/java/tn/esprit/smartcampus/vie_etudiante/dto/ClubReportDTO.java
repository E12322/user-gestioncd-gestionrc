package tn.esprit.smartcampus.vie_etudiante.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import tn.esprit.smartcampus.vie_etudiante.model.CampusEvent;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClubReportDTO {
    private String clubId;
    private String clubName;
    private String category;
    private int year;
    private int totalMembers;
    private int confirmedMembers;
    private int pendingMembers;
    private int refusedMembers;
    private int totalEvents;
    private List<CampusEvent> events;
    private List<MemberDetailDTO> members;
}

package tn.esprit.smartcampus.vie_etudiante.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
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
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ClubDetailDTO {
    private String id;
    private String name;
    private String category;
    private String description;
    private String meetingPlace;
    private int members;
    private int maxMembers;
    private MyMembershipDTO myMembership;
    private List<String> memberNames;
    private List<CampusEvent> events;
}

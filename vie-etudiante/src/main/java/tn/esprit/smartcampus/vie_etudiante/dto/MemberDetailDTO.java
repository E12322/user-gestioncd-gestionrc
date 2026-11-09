package tn.esprit.smartcampus.vie_etudiante.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MemberDetailDTO {
    private String memberId;
    private String memberName;
    private String memberRole;
    private String status;
    private String requestedAt;
    private String decidedAt;
}

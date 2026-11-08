package tn.esprit.smartcampus.vie_etudiante.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "memberships")
@CompoundIndex(name = "club_member_idx", def = "{'clubId': 1, 'memberId': 1}")
public class Membership {

    @Id
    private String id;

    @Indexed
    private String clubId;

    private String clubName;

    @Indexed
    private String memberId;

    private String memberName;

    private String memberRole;

    @Indexed
    @Builder.Default
    private String status = "pending"; // pending, confirmed, refused

    private String requestedAt;

    private String decidedAt;
}

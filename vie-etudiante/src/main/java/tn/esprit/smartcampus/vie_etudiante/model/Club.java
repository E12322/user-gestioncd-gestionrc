package tn.esprit.smartcampus.vie_etudiante.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "clubs")
public class Club {

    @Id
    private String id;

    @Indexed(unique = true)
    private String name;

    private String category;

    private String description;

    private String meetingPlace;

    @Builder.Default
    private int members = 0;

    private int maxMembers;
}

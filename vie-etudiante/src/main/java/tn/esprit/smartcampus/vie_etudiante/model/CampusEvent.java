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
@Document(collection = "events")
public class CampusEvent {

    @Id
    private String id;

    private String title;

    private String description;

    @Indexed
    private String date; // "YYYY-MM-DD"

    private String start; // "HH:MM"

    private String end; // "HH:MM"

    private String location;

    @Indexed
    private String clubId;

    private String clubName;
}

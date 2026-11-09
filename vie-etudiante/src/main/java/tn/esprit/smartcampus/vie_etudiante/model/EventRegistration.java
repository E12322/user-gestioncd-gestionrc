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
@Document(collection = "event_registrations")
@CompoundIndex(name = "event_student_idx", def = "{'eventId': 1, 'studentId': 1}", unique = true)
public class EventRegistration {

    @Id
    private String id;

    @Indexed
    private String eventId;

    private String eventTitle;

    @Indexed
    private String studentId;

    private String studentName;

    private String registeredAt;
}

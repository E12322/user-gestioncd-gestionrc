package tn.esprit.smartcampus.vie_etudiante.exception;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Format d'erreur standard de SmartCampus :
 * { "message": "...", "code": "...", "conflicts": [...] }
 * Compatible avec le user-service et le client ApiError du front-end.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ErrorResponse {
    private String message;
    private String code;
    private List<String> conflicts;

    public ErrorResponse(String message, String code) {
        this.message = message;
        this.code = code;
    }
}

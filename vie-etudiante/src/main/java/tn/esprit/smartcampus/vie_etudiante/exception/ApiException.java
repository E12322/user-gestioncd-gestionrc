package tn.esprit.smartcampus.vie_etudiante.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

import java.util.List;

@Getter
public class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final List<String> conflicts;

    public ApiException(HttpStatus status, String message, String code) {
        super(message);
        this.status = status;
        this.code = code;
        this.conflicts = null;
    }

    public ApiException(HttpStatus status, String message, String code, List<String> conflicts) {
        super(message);
        this.status = status;
        this.code = code;
        this.conflicts = conflicts;
    }
}

package tn.esprit.smartcampus.vie_etudiante.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import tn.esprit.smartcampus.vie_etudiante.dto.ClubReportDTO;
import tn.esprit.smartcampus.vie_etudiante.security.JwtPrincipal;
import tn.esprit.smartcampus.vie_etudiante.service.ReportService;

import java.time.LocalDate;

@RestController
@RequestMapping("/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    @GetMapping("/clubs/{clubId}")
    public ResponseEntity<ClubReportDTO> clubReport(
            @PathVariable String clubId,
            @RequestParam(required = false) Integer year,
            @AuthenticationPrincipal JwtPrincipal viewer) {
        int reportYear = year != null ? year : LocalDate.now().getYear();
        return ResponseEntity.ok(reportService.generateClubReport(clubId, reportYear, viewer));
    }
}

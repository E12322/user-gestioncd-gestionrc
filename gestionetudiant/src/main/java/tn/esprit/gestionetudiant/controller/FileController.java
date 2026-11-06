package tn.esprit.gestionetudiant.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import tn.esprit.gestionetudiant.exception.BusinessException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Upload des supports pédagogiques (PDF, PPTX, DOCX, ZIP, vidéo...) côté backend.
 * Les fichiers sont stockés sur disque (répertoire `app.uploads.dir`) et servis
 * sous /uploads/** ; l'URL retournée est absolue pour être consommable par le front.
 */
@RestController
@RequestMapping("/api/academic/v1/files")
public class FileController {

    @Value("${app.uploads.dir:${user.dir}/uploads}")
    private String uploadsDir;

    private static final long TAILLE_MAX = 60L * 1024 * 1024; // 60 Mo

    /** Formats acceptés (extension en minuscules). */
    private static final Map<String, String> EXTENSION_VERS_FORMAT = Map.ofEntries(
            Map.entry("pdf", "PDF"),
            Map.entry("ppt", "PPTX"), Map.entry("pptx", "PPTX"),
            Map.entry("doc", "DOCX"), Map.entry("docx", "DOCX"),
            Map.entry("xls", "XLSX"), Map.entry("xlsx", "XLSX"), Map.entry("csv", "CSV"),
            Map.entry("zip", "ZIP"), Map.entry("rar", "ZIP"), Map.entry("7z", "ZIP"),
            Map.entry("mp4", "MP4"), Map.entry("webm", "WEBM"), Map.entry("mkv", "MKV"), Map.entry("mov", "MOV"),
            Map.entry("png", "IMAGE"), Map.entry("jpg", "IMAGE"), Map.entry("jpeg", "IMAGE"), Map.entry("gif", "IMAGE")
    );

    /** POST /api/academic/v1/files/upload — multipart, renvoie { url, nomFichier, taille, format }. */
    @PostMapping("/upload")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> upload(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("Aucun fichier reçu : sélectionnez un fichier à uploader.");
        }
        if (file.getSize() > TAILLE_MAX) {
            throw new BusinessException("Fichier trop volumineux (max 60 Mo).");
        }

        String nomOriginal = file.getOriginalFilename() == null ? "fichier" : file.getOriginalFilename();
        String extension = extensionDe(nomOriginal);
        String format = EXTENSION_VERS_FORMAT.getOrDefault(extension, extension.toUpperCase(Locale.ROOT));

        try {
            Path repertoire = Paths.get(uploadsDir).toAbsolutePath().normalize();
            Files.createDirectories(repertoire);

            // Nom unique : le nom original est conservé dans le nom final (lisible) + un identifiant court.
            String base = nomOriginal.replaceAll("[\\\\/:*?\"<>|]", "_");
            if (base.length() > 80) {
                base = base.substring(base.length() - 80);
            }
            String nomStocke = UUID.randomUUID().toString().substring(0, 8) + "_" + base;
            Path cible = repertoire.resolve(nomStocke);

            try (InputStream in = file.getInputStream()) {
                Files.copy(in, cible, StandardCopyOption.REPLACE_EXISTING);
            }

            String url = ServletUriComponentsBuilder.fromCurrentContextPath()
                    .path("/uploads/")
                    .path(nomStocke)
                    .toUriString();

            return Map.of(
                    "url", url,
                    "nomFichier", nomStocke,
                    "nomOriginal", nomOriginal,
                    "taille", tailleLisible(file.getSize()),
                    "format", format);
        } catch (IOException e) {
            throw new BusinessException("Échec de l'enregistrement du fichier sur le serveur.");
        }
    }

    private String extensionDe(String nom) {
        int idx = nom.lastIndexOf('.');
        return idx >= 0 && idx < nom.length() - 1 ? nom.substring(idx + 1).toLowerCase(Locale.ROOT) : "";
    }

    /** Taille lisible : « 4,43 Mo ». */
    private String tailleLisible(long octets) {
        if (octets < 1024) {
            return octets + " o";
        }
        if (octets < 1024 * 1024) {
            return String.format(Locale.FRENCH, "%.2f Ko", octets / 1024.0);
        }
        return String.format(Locale.FRENCH, "%.2f Mo", octets / (1024.0 * 1024.0));
    }
}

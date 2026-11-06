package tn.esprit.gestionetudiant.common.dto;

import org.springframework.data.domain.Page;

import java.util.List;

/**
 * Réponse paginée standard de l'API académique.
 * Utilisée par tous les endpoints de liste afin que le front ait un contrat unique.
 */
public record PageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean first,
        boolean last
) {

    public static <T> PageResponse<T> from(Page<T> page) {
        return new PageResponse<>(
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.isFirst(),
                page.isLast()
        );
    }
}

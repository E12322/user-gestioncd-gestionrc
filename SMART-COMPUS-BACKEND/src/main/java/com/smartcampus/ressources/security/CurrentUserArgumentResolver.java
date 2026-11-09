package com.smartcampus.ressources.security;

import org.springframework.core.MethodParameter;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Injecte dans les contrôleurs l'identité du JWT, à la place des anciens en-têtes {@code X-User-*} que n'importe quel
 * client pouvait forger : {@code @CurrentUserId Long id}, {@code @CurrentUserName String nom}, {@code @CurrentUserRole String role}.
 */
@Component
public class CurrentUserArgumentResolver implements HandlerMethodArgumentResolver {

    @Target(ElementType.PARAMETER) @Retention(RetentionPolicy.RUNTIME) @Documented
    public @interface CurrentUserId { }

    @Target(ElementType.PARAMETER) @Retention(RetentionPolicy.RUNTIME) @Documented
    public @interface CurrentUserName { }

    @Target(ElementType.PARAMETER) @Retention(RetentionPolicy.RUNTIME) @Documented
    public @interface CurrentUserRole { }

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return parameter.hasParameterAnnotation(CurrentUserId.class)
                || parameter.hasParameterAnnotation(CurrentUserName.class)
                || parameter.hasParameterAnnotation(CurrentUserRole.class);
    }

    @Override
    public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                                  NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
        CurrentUser.Principal principal = CurrentUser.require(); // SecurityConfig garantit un utilisateur sur ces routes
        if (parameter.hasParameterAnnotation(CurrentUserId.class)) return principal.numericId();
        if (parameter.hasParameterAnnotation(CurrentUserName.class)) return principal.displayName();
        return principal.role();
    }
}

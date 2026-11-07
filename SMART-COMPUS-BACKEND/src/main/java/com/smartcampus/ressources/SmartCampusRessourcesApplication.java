package com.smartcampus.ressources;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class SmartCampusRessourcesApplication {

    public static void main(String[] args) {
        SpringApplication.run(SmartCampusRessourcesApplication.class, args);
    }
}

package com.nha.abdm.hip;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.ArrayList;
import java.util.List;

public class HealthInformationResponse {
    public List<HealthInformationBundle> getHealthInformationBundle() {
        return healthInformationBundle;
    }

    public void setHealthInformationBundle(List<HealthInformationBundle> healthInformationBundle) {
        this.healthInformationBundle = healthInformationBundle;
    }

    @JsonProperty
    private List<HealthInformationBundle> healthInformationBundle;
}

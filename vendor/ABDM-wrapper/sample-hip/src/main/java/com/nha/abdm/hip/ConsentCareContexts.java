/* (C) 2024 */
package com.nha.abdm.hip;


public class ConsentCareContexts {
  private String patientReference;

  public String getPatientReference() {
    return patientReference;
  }

  public void setPatientReference(String patientReference) {
    this.patientReference = patientReference;
  }

  public String getCareContextReference() {
    return careContextReference;
  }

  public void setCareContextReference(String careContextReference) {
    this.careContextReference = careContextReference;
  }

  private String careContextReference;
}

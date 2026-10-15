/* (C) 2024 */
package com.nha.abdm.hip;


import com.fasterxml.jackson.annotation.JsonProperty;

public class HealthInformationBundle {
  @JsonProperty
  private String careContextReference;
  @JsonProperty
  private String bundleContent;
  public void setBundleContent(String bundleContent){
    this.bundleContent=bundleContent;
  }
  public void setCareContextReference(String careContextReference) {
    this.careContextReference = careContextReference;
  }
}

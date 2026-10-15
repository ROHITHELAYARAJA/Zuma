package com.nha.abdm.gateway;

import com.nha.abdm.api.ConsentFlowApi;
import com.nha.abdm.api.DataFlowApi;
import com.nha.abdm.api.LinkApi;
import com.nha.abdm.api.UserAuthApi;
import com.nha.abdm.api.V05Api;
import com.nha.abdm.invoker.ApiException;
import com.nha.abdm.model.CareContextDefinition;
import com.nha.abdm.model.CareContextRepresentation;
import com.nha.abdm.model.ConsentArtefactReference;
import com.nha.abdm.model.ConsentArtefactResponse;
import com.nha.abdm.model.ConsentArtefactResponseConsent;
import com.nha.abdm.model.ConsentArtefactResponseConsentConsentDetail;
import com.nha.abdm.model.ConsentArtefactResponseConsentConsentDetailConsentManager;
import com.nha.abdm.model.ConsentArtefactResponseConsentConsentDetailHiu;
import com.nha.abdm.model.ConsentFetchRequest;
import com.nha.abdm.model.ConsentManagerPatientID;
import com.nha.abdm.model.ConsentRequest;
import com.nha.abdm.model.ConsentRequestInitResponse;
import com.nha.abdm.model.ConsentRequestInitResponseConsentRequest;
import com.nha.abdm.model.ConsentRequestStatusRequest;
import com.nha.abdm.model.ConsentStatus;
import com.nha.abdm.model.HIPConsentNotification;
import com.nha.abdm.model.HIPConsentNotificationNotification;
import com.nha.abdm.model.HIPConsentNotificationNotificationConsentDetail;
import com.nha.abdm.model.HIPConsentNotificationNotificationConsentDetailCareContextsInner;
import com.nha.abdm.model.HIPConsentNotificationNotificationConsentDetailConsentManager;
import com.nha.abdm.model.HIPConsentNotificationResponse;
import com.nha.abdm.model.HIPHIRequest;
import com.nha.abdm.model.HIPHIRequestHiRequest;
import com.nha.abdm.model.HIPHealthInformationRequestAcknowledgement;
import com.nha.abdm.model.HIRequest;
import com.nha.abdm.model.HIUConsentNotificationEvent;
import com.nha.abdm.model.HIUConsentNotificationEventNotification;
import com.nha.abdm.model.HIUConsentNotificationResponse;
import com.nha.abdm.model.HIUConsentRequestStatus;
import com.nha.abdm.model.HIUConsentRequestStatusConsentRequest;
import com.nha.abdm.model.HIUHealthInformationRequestResponse;
import com.nha.abdm.model.HIUHealthInformationRequestResponseHiRequest;
import com.nha.abdm.model.HIUHealthInformationRequestResponseHiRequest.SessionStatusEnum;
import com.nha.abdm.model.HealthInformationNotification;
import com.nha.abdm.model.PatientAuthConfirmRequest;
import com.nha.abdm.model.PatientAuthConfirmResponse;
import com.nha.abdm.model.PatientAuthConfirmResponseAuth;
import com.nha.abdm.model.PatientAuthInitRequest;
import com.nha.abdm.model.PatientAuthInitResponse;
import com.nha.abdm.model.PatientAuthInitResponseAuth;
import com.nha.abdm.model.PatientCareContextLinkRequest;
import com.nha.abdm.model.PatientCareContextLinkResponse;
import com.nha.abdm.model.PatientCareContextLinkResponseAcknowledgement;
import com.nha.abdm.model.PatientCareContextLinkResponseAcknowledgement.StatusEnum;
import com.nha.abdm.model.RequestReference;
import com.nha.abdm.model.Requester;
import com.nha.abdm.model.RequesterIdentifier;
import com.nha.abdm.model.SessionRequest;
import com.nha.abdm.model.SessionResponse;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.CollectionUtils;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class GatewayController implements V05Api {

  private UserAuthApi userAuthApi = new UserAuthApi();
  private LinkApi linkApi = new LinkApi();
  private ConsentFlowApi consentFlowApi = new ConsentFlowApi();
  private DataFlowApi dataFlowApi = new DataFlowApi();

  public GatewayController() {
    String callback = System.getenv().getOrDefault("WRAPPER_CALLBACK_URL", "http://abdm-wrapper:8082");
    userAuthApi.getApiClient().setBasePath(callback);
    linkApi.getApiClient().setBasePath(callback);
    consentFlowApi.getApiClient().setBasePath(callback);
    dataFlowApi.getApiClient().setBasePath(callback);
  }

  private Map<String, List<String>> linkedCareContextMap = new HashMap<>();
  private Map<String, List<ConsentArtefactReference>> consentRequestArtefactsMap = new HashMap();
  private Map<String, HIPConsentNotificationNotificationConsentDetail> consentDetailMap = new HashMap<>();

  @Override
  public ResponseEntity<SessionResponse> v05SessionsPost(SessionRequest sessionRequest) {
    SessionResponse sessionResponse = new SessionResponse();
    sessionResponse.setAccessToken("random-access-token");
    return new ResponseEntity<>(sessionResponse, HttpStatus.OK);
  }

  @Override
  public ResponseEntity<Void> v05UsersAuthInitPost(String authorization, String X_CM_ID,
      PatientAuthInitRequest patientAuthInitRequest) {

    UUID requestId = patientAuthInitRequest.getRequestId();

    PatientAuthInitResponseAuth patientAuthInitResponseAuth = new PatientAuthInitResponseAuth();
    patientAuthInitResponseAuth.setTransactionId(UUID.randomUUID().toString());
    patientAuthInitResponseAuth.setMode(patientAuthInitRequest.getQuery().getAuthMode());

    PatientAuthInitResponse patientAuthInitResponse = new PatientAuthInitResponse();
    patientAuthInitResponse.setRequestId(UUID.randomUUID());
    patientAuthInitResponse.setAuth(patientAuthInitResponseAuth);
    patientAuthInitResponse.setResp(getRequestReference(requestId));

    new Thread(() -> {
      try {
        Thread.sleep(1000);
        userAuthApi.v05UsersAuthOnInitPost(authorization, "x_hip_id",
            "x_hiu_id", patientAuthInitResponse);
      } catch (ApiException | InterruptedException e) {
        throw new RuntimeException(e);
      }
    }).start();

    return new ResponseEntity<>(HttpStatus.ACCEPTED);
  }

  @Override
  public ResponseEntity<Void> v05UsersAuthConfirmPost(String authorization, String X_CM_ID,
      PatientAuthConfirmRequest patientAuthConfirmRequest) {

    UUID requestId = patientAuthConfirmRequest.getRequestId();

    PatientAuthConfirmResponseAuth patientAuthConfirmResponseAuth = new PatientAuthConfirmResponseAuth();
    patientAuthConfirmResponseAuth.setAccessToken(UUID.randomUUID().toString());

    PatientAuthConfirmResponse patientAuthConfirmResponse = new PatientAuthConfirmResponse();
    patientAuthConfirmResponse.setRequestId(UUID.randomUUID());
    patientAuthConfirmResponse.setAuth(patientAuthConfirmResponseAuth);
    patientAuthConfirmResponse.setResp(getRequestReference(requestId));

    new Thread(() -> {
      try {
        Thread.sleep(1000);
        userAuthApi.v05UsersAuthOnConfirmPost(authorization, "x_hip_id",
            "x_hiu_id", patientAuthConfirmResponse);
      } catch (ApiException | InterruptedException e) {
        throw new RuntimeException(e);
      }
    }).start();

    return new ResponseEntity<>(HttpStatus.ACCEPTED);
  }

  @Override
  public ResponseEntity<Void> v05LinksLinkAddContextsPost(String authorization, String X_CM_ID,
      PatientCareContextLinkRequest patientCareContextLinkRequest) {

    UUID requestId = patientCareContextLinkRequest.getRequestId();

    boolean careContextsLinked = areAllCareContextsLinked(patientCareContextLinkRequest);
    if (careContextsLinked) {
      return new ResponseEntity<>(HttpStatus.ALREADY_REPORTED);
    }

    PatientCareContextLinkResponseAcknowledgement patientCareContextLinkResponseAcknowledgement =
        new PatientCareContextLinkResponseAcknowledgement();
    patientCareContextLinkResponseAcknowledgement.setStatus(StatusEnum.SUCCESS);

    PatientCareContextLinkResponse patientCareContextLinkResponse = new PatientCareContextLinkResponse();
    patientCareContextLinkResponse.setRequestId(UUID.randomUUID());
    patientCareContextLinkResponse.setAcknowledgement(patientCareContextLinkResponseAcknowledgement);
    patientCareContextLinkResponse.setResp(getRequestReference(requestId));

    new Thread(() -> {
      try {
        Thread.sleep(1000);
        linkApi.v05LinksLinkOnAddContextsPost(authorization, "x_hip_id",
            patientCareContextLinkResponse);
      } catch (ApiException | InterruptedException e) {
        throw new RuntimeException(e);
      }
    }).start();

    return new ResponseEntity<>(HttpStatus.ACCEPTED);
  }

  @Override
  public ResponseEntity<Void> v05ConsentRequestsInitPost(String authorization, String X_CM_ID,
      ConsentRequest consentRequest) {

    UUID requestId = consentRequest.getRequestId();

    UUID consentRequestId = UUID.randomUUID();
    ConsentRequestInitResponseConsentRequest consentRequestInitResponseConsentRequest =
        new ConsentRequestInitResponseConsentRequest();
    consentRequestInitResponseConsentRequest.setId(consentRequestId);

    ConsentRequestInitResponse consentRequestInitResponse = new ConsentRequestInitResponse();
    consentRequestInitResponse.setRequestId(UUID.randomUUID());
    consentRequestInitResponse.setConsentRequest(consentRequestInitResponseConsentRequest);
    consentRequestInitResponse.setResp(getRequestReference(requestId));

    new Thread(() -> {
      try {
        Thread.sleep(1000);
        consentFlowApi.v05ConsentRequestsOnInitPost(authorization, "x_hiu_id",
            consentRequestInitResponse);

        // Simulate PHR app consent grant here and assume that it has been granted.
        Thread.sleep(1000);

        UUID consentId = UUID.randomUUID();
        // Send HIP Notification.
        HIPConsentNotification hipConsentNotification = getHIPConsentNotification(consentRequest, consentId);
        consentFlowApi.v05ConsentsHipNotifyPost(authorization, "x_hip_id", hipConsentNotification);
        HIUConsentNotificationEvent hiuConsentNotificationEvent = getHIUConsentNotificationEvent(consentId, consentRequestId);
        // Send HIU Notification.
        consentFlowApi.v05ConsentsHiuNotifyPost(authorization, "x_hiu_id", hiuConsentNotificationEvent);

      } catch (ApiException | InterruptedException e) {
        throw new RuntimeException(e);
      }
    }).start();

    return new ResponseEntity<>(HttpStatus.ACCEPTED);
  }

  @Override
  public ResponseEntity<Void> v05ConsentRequestsStatusPost(String authorization, String X_CM_ID,
      ConsentRequestStatusRequest consentRequestStatusRequest) {

    UUID requestId = consentRequestStatusRequest.getRequestId();
    String consentRequestId = consentRequestStatusRequest.getConsentRequestId();
    List<ConsentArtefactReference> consentArtefactReferences = consentRequestArtefactsMap.get(consentRequestId);

    new Thread(() -> {
      try {
        Thread.sleep(1000);
        HIUConsentRequestStatus hiuConsentRequestStatus = new HIUConsentRequestStatus();
        hiuConsentRequestStatus.setRequestId(UUID.randomUUID());

        HIUConsentRequestStatusConsentRequest hiuConsentRequestStatusConsentRequest = new HIUConsentRequestStatusConsentRequest();
        hiuConsentRequestStatusConsentRequest.setConsentArtefacts(consentArtefactReferences);
        hiuConsentRequestStatusConsentRequest.setStatus(ConsentStatus.GRANTED);
        hiuConsentRequestStatusConsentRequest.setId(consentRequestId);
        hiuConsentRequestStatus.setConsentRequest(hiuConsentRequestStatusConsentRequest);

        hiuConsentRequestStatus.setResp(getRequestReference(requestId));

        consentFlowApi.v05ConsentRequestsOnStatusPost(authorization, "x_hiu_id", hiuConsentRequestStatus);

      } catch (ApiException | InterruptedException e) {
        throw new RuntimeException(e);
      }
    }).start();
    return new ResponseEntity<>(HttpStatus.ACCEPTED);
  }

  @Override
  public ResponseEntity<Void> v05ConsentsFetchPost(String authorization, String X_CM_ID,
      ConsentFetchRequest consentFetchRequest) {

    UUID requestId = consentFetchRequest.getRequestId();
    String consentId = consentFetchRequest.getConsentId();

    new Thread(() -> {
      try {
        Thread.sleep(1000);

        ConsentArtefactResponse consentArtefactResponse = getConsentArtefactResponse(requestId, consentId);
        consentFlowApi.v05ConsentsOnFetchPost(authorization, "x_hiu_id", consentArtefactResponse);

      } catch (ApiException | InterruptedException e) {
        throw new RuntimeException(e);
      }
    }).start();
    return new ResponseEntity<>(HttpStatus.ACCEPTED);
  }

  @Override
  public ResponseEntity<Void> v05ConsentsHipOnNotifyPost(String authorization, String X_CM_ID,
      HIPConsentNotificationResponse hiPConsentNotificationResponse) {
    return new ResponseEntity<>(HttpStatus.ACCEPTED);
  }

  @Override
  public ResponseEntity<Void> v05ConsentsHiuOnNotifyPost(String authorization, String X_CM_ID,
      HIUConsentNotificationResponse hiUConsentNotificationResponse) {
    return new ResponseEntity<>(HttpStatus.ACCEPTED);
  }

  @Override
  public ResponseEntity<Void> v05HealthInformationCmRequestPost(String authorization,
      String X_CM_ID, HIRequest hiRequest) {

    new Thread(() -> {
      try {
        Thread.sleep(1000);
        UUID requestId = hiRequest.getRequestId();
        UUID transactionId = UUID.randomUUID();

        // Send on request back to HIU.
        HIUHealthInformationRequestResponse hiuHealthInformationRequestResponse =
            new HIUHealthInformationRequestResponse();
        hiuHealthInformationRequestResponse.setRequestId(UUID.randomUUID());

        HIUHealthInformationRequestResponseHiRequest hiuHealthInformationRequestResponseHiRequest =
            new HIUHealthInformationRequestResponseHiRequest();
        hiuHealthInformationRequestResponseHiRequest.setSessionStatus(SessionStatusEnum.REQUESTED);
        hiuHealthInformationRequestResponseHiRequest.setTransactionId(transactionId);
        hiuHealthInformationRequestResponse.setHiRequest(hiuHealthInformationRequestResponseHiRequest);

        hiuHealthInformationRequestResponse.setResp(getRequestReference(requestId));

        dataFlowApi.v05HealthInformationHiuOnRequestPost(authorization, "x_hiu_id", hiuHealthInformationRequestResponse);

        // Issue a request to HIP.
        HIPHIRequestHiRequest hiphiRequestHiRequest = new HIPHIRequestHiRequest();
        hiphiRequestHiRequest.setConsent(hiRequest.getHiRequest().getConsent());
        hiphiRequestHiRequest.setDateRange(hiRequest.getHiRequest().getDateRange());
        hiphiRequestHiRequest.setDataPushUrl(hiRequest.getHiRequest().getDataPushUrl());
        hiphiRequestHiRequest.setKeyMaterial(hiRequest.getHiRequest().getKeyMaterial());

        HIPHIRequest hiphiRequest = new HIPHIRequest();
        hiphiRequest.setRequestId(UUID.randomUUID());
        hiphiRequest.setHiRequest(hiphiRequestHiRequest);
        hiphiRequest.setTransactionId(transactionId);

        dataFlowApi.v05HealthInformationHipRequestPost(authorization, "x_hip_id", hiphiRequest);

      } catch (ApiException | InterruptedException e) {
        throw new RuntimeException(e);
      }
    }).start();

    return new ResponseEntity<>(HttpStatus.ACCEPTED);
  }

  @Override
  public ResponseEntity<Void> v05HealthInformationHipOnRequestPost(String authorization,
      String X_CM_ID,
      HIPHealthInformationRequestAcknowledgement hiPHealthInformationRequestAcknowledgement) {
    return new ResponseEntity<>(HttpStatus.ACCEPTED);
  }

  @Override
  public ResponseEntity<Void> v05HealthInformationNotifyPost(String authorization, String X_CM_ID,
      HealthInformationNotification healthInformationNotification) {
    return new ResponseEntity<>(HttpStatus.ACCEPTED);
  }

  private RequestReference getRequestReference(UUID requestId) {
    RequestReference requestReference = new RequestReference();
    requestReference.setRequestId(requestId);
    return requestReference;
  }

  private boolean areAllCareContextsLinked(PatientCareContextLinkRequest patientCareContextLinkRequest) {
    String patientReferenceNumber = patientCareContextLinkRequest.getLink().getPatient().getReferenceNumber();
    List<CareContextRepresentation> careContexts = patientCareContextLinkRequest.getLink().getPatient().getCareContexts();
    List<String> linkedCareContexts = linkedCareContextMap.get(patientReferenceNumber);
    if (Objects.isNull(linkedCareContexts)) {
      linkedCareContexts = new ArrayList<>();
      for (CareContextRepresentation careContextRepresentation : careContexts) {
        linkedCareContexts.add(careContextRepresentation.getReferenceNumber());
      }
      linkedCareContextMap.put(patientReferenceNumber, linkedCareContexts);
    } else {
      int linkedCareContextCount = 0;
      for (CareContextRepresentation careContextRepresentation : careContexts) {
        if(linkedCareContexts.contains(careContextRepresentation.getReferenceNumber())) {
          linkedCareContextCount++;
        } else {
          linkedCareContexts.add(careContextRepresentation.getReferenceNumber());
        }
      }
      if (linkedCareContextCount == careContexts.size()) {
        return true;
      }
    }
    return false;
  }

  private HIPConsentNotification getHIPConsentNotification(ConsentRequest consentRequest, UUID consentId) {

    HIPConsentNotificationNotificationConsentDetail hipConsentNotificationNotificationConsentDetail
        = new HIPConsentNotificationNotificationConsentDetail();

    hipConsentNotificationNotificationConsentDetail.setConsentId(consentId);

    HIPConsentNotificationNotificationConsentDetailConsentManager hipConsentNotificationNotificationConsentDetailConsentManager
        = new HIPConsentNotificationNotificationConsentDetailConsentManager();
    hipConsentNotificationNotificationConsentDetailConsentManager.setId("random-consent-manager");
    hipConsentNotificationNotificationConsentDetail.setConsentManager(hipConsentNotificationNotificationConsentDetailConsentManager);

    ConsentManagerPatientID consentManagerPatientID = new ConsentManagerPatientID();
    consentManagerPatientID.setId(consentRequest.getConsent().getPatient().getId());
    hipConsentNotificationNotificationConsentDetail.setPatient(consentManagerPatientID);

    List<HIPConsentNotificationNotificationConsentDetailCareContextsInner> careContextsInners = new ArrayList<>();
    List<CareContextDefinition> careContexts = consentRequest.getConsent().getCareContexts();
    if (!CollectionUtils.isEmpty(careContexts)) {
      for (CareContextDefinition careContextDefinition : careContexts) {
        HIPConsentNotificationNotificationConsentDetailCareContextsInner hipConsentNotificationNotificationConsentDetailCareContextsInner
            = new HIPConsentNotificationNotificationConsentDetailCareContextsInner();
        hipConsentNotificationNotificationConsentDetailCareContextsInner.setCareContextReference(
            careContextDefinition.getCareContextReference());
        hipConsentNotificationNotificationConsentDetailCareContextsInner.setPatientReference(
            careContextDefinition.getPatientReference());
        careContextsInners.add(hipConsentNotificationNotificationConsentDetailCareContextsInner);
      }
      hipConsentNotificationNotificationConsentDetail.setCareContexts(careContextsInners);
    }

    hipConsentNotificationNotificationConsentDetail.setHip(consentRequest.getConsent().getHip());
    hipConsentNotificationNotificationConsentDetail.setPermission(consentRequest.getConsent()
        .getPermission());
    hipConsentNotificationNotificationConsentDetail.setHiTypes(consentRequest.getConsent().getHiTypes());
    hipConsentNotificationNotificationConsentDetail.setPermission(consentRequest.getConsent()
        .getPermission());
    hipConsentNotificationNotificationConsentDetail.setSchemaVersion("1.2.3");
    hipConsentNotificationNotificationConsentDetail.setCreatedAt(OffsetDateTime.now());

    consentDetailMap.put(consentId.toString(), hipConsentNotificationNotificationConsentDetail);

    HIPConsentNotificationNotification hipConsentNotificationNotification =
        new HIPConsentNotificationNotification();
    hipConsentNotificationNotification.setConsentDetail(hipConsentNotificationNotificationConsentDetail);
    hipConsentNotificationNotification.setConsentId(consentId);
    hipConsentNotificationNotification.setStatus(ConsentStatus.GRANTED);
    hipConsentNotificationNotification.setSignature("some-random-signature");

    HIPConsentNotification hipConsentNotification = new HIPConsentNotification();
    hipConsentNotification.setRequestId(UUID.randomUUID());
    hipConsentNotification.setNotification(hipConsentNotificationNotification);

    return hipConsentNotification;
  }

  private HIUConsentNotificationEvent getHIUConsentNotificationEvent(UUID consentId, UUID consentRequestId) {

    HIUConsentNotificationEventNotification hiuConsentNotificationEventNotification = new HIUConsentNotificationEventNotification();
    hiuConsentNotificationEventNotification.setConsentRequestId(consentRequestId.toString());

    List<ConsentArtefactReference> consentArtefacts = new ArrayList<>();
    ConsentArtefactReference consentArtefactReference = new ConsentArtefactReference();
    consentArtefactReference.setId(consentId.toString());
    consentArtefacts.add(consentArtefactReference);
    hiuConsentNotificationEventNotification.setConsentArtefacts(consentArtefacts);

    consentRequestArtefactsMap.put(consentRequestId.toString(), consentArtefacts);

    hiuConsentNotificationEventNotification.setStatus(ConsentStatus.GRANTED);

    HIUConsentNotificationEvent hiuConsentNotificationEvent = new HIUConsentNotificationEvent();
    hiuConsentNotificationEvent.setRequestId(UUID.randomUUID());
    hiuConsentNotificationEvent.setNotification(hiuConsentNotificationEventNotification);

    return hiuConsentNotificationEvent;
  }

  private ConsentArtefactResponse getConsentArtefactResponse(UUID requestId, String consentId) {

    HIPConsentNotificationNotificationConsentDetail hipConsentNotificationNotificationConsentDetail
        = consentDetailMap.get(consentId);

    ConsentArtefactResponseConsentConsentDetail consentArtefactResponseConsentConsentDetail =
        new ConsentArtefactResponseConsentConsentDetail();

    consentArtefactResponseConsentConsentDetail.setSchemaVersion("1.2.3");
    consentArtefactResponseConsentConsentDetail.setConsentId(hipConsentNotificationNotificationConsentDetail.getConsentId());
    consentArtefactResponseConsentConsentDetail.setCreatedAt(hipConsentNotificationNotificationConsentDetail.getCreatedAt());
    consentArtefactResponseConsentConsentDetail.setPatient(hipConsentNotificationNotificationConsentDetail.getPatient());
    consentArtefactResponseConsentConsentDetail.setCareContexts(hipConsentNotificationNotificationConsentDetail.getCareContexts());
    consentArtefactResponseConsentConsentDetail.setPurpose(hipConsentNotificationNotificationConsentDetail.getPurpose());
    consentArtefactResponseConsentConsentDetail.setHip(hipConsentNotificationNotificationConsentDetail.getHip());

    ConsentArtefactResponseConsentConsentDetailHiu consentArtefactResponseConsentConsentDetailHiu
        = new ConsentArtefactResponseConsentConsentDetailHiu();
    consentArtefactResponseConsentConsentDetailHiu.setId("x_hiu_id");
    consentArtefactResponseConsentConsentDetail.setHiu(consentArtefactResponseConsentConsentDetailHiu);

    ConsentArtefactResponseConsentConsentDetailConsentManager consentArtefactResponseConsentConsentDetailConsentManager
        = new ConsentArtefactResponseConsentConsentDetailConsentManager();
    consentArtefactResponseConsentConsentDetailConsentManager.setId(hipConsentNotificationNotificationConsentDetail.getConsentManager().getId());
    consentArtefactResponseConsentConsentDetail.setConsentManager(consentArtefactResponseConsentConsentDetailConsentManager);

    Requester requester = new Requester();
    requester.setName("random requester");
    RequesterIdentifier requesterIdentifier = new RequesterIdentifier();
    requesterIdentifier.setSystem("https://www.mciindia.org");
    requesterIdentifier.setType("REGNO");
    requesterIdentifier.setValue("MH1001");
    requester.setIdentifier(requesterIdentifier);
    consentArtefactResponseConsentConsentDetail.setRequester(requester);

    consentArtefactResponseConsentConsentDetail.setHiTypes(hipConsentNotificationNotificationConsentDetail.getHiTypes());
    consentArtefactResponseConsentConsentDetail.setPermission(hipConsentNotificationNotificationConsentDetail.getPermission());

    ConsentArtefactResponseConsent consentArtefactResponseConsent = new ConsentArtefactResponseConsent();
    consentArtefactResponseConsent.setStatus(ConsentStatus.GRANTED);
    consentArtefactResponseConsent.setConsentDetail(consentArtefactResponseConsentConsentDetail);
    consentArtefactResponseConsent.setSignature("some-random-signature");

    ConsentArtefactResponse consentArtefactResponse = new ConsentArtefactResponse();
    consentArtefactResponse.setRequestId(UUID.randomUUID());
    consentArtefactResponse.setConsent(consentArtefactResponseConsent);
    consentArtefactResponse.setResp(getRequestReference(requestId));

    return consentArtefactResponse;
  }
}

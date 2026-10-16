import Landing from '../web/Landing';
import dataset from '../data/abdm/dataset.json';
import type { PublicReport } from '../web/RepositoryStory';
export default function Page(){
  const reports: PublicReport[] = dataset.reports.map(report => ({ id: report.reportId, name: report.name, birthDate: report.birthDate, hospital: report.hospitalId, date: report.clinicalDate.slice(0,10), source: report.source, count: report.bundle.entry.length, resources: report.bundle.entry.flatMap(entry => {
    const r=entry.resource as Record<string,unknown>;
    if(!['AllergyIntolerance','MedicationRequest','Observation','Condition'].includes(String(r.resourceType)))return [];
    const code=(r.code??r.medicationCodeableConcept) as {text?:string;coding?:{display?:string}[]}|undefined;
    const quantity=r.valueQuantity as {value?:number;unit?:string}|undefined;
    const concept=r.valueCodeableConcept as {text?:string}|undefined;
    const label=code?.text??code?.coding?.[0]?.display;
    if(!label)return [];
    const status=typeof r.status==='string'?r.status:((r.clinicalStatus as {coding?:{code?:string}[]})?.coding?.[0]?.code);
    return [{id:String(r.id),type:String(r.resourceType),label,value:quantity?.value!==undefined?`${quantity.value} ${quantity.unit??''}`:concept?.text??(status?`Recorded status: ${status}`:'Recorded in source; interpretation requires clinician review.'),date:String(r.effectiveDateTime??r.recordedDate??report.clinicalDate)}];
  }).slice(0,8) }));
  return <Landing reports={reports} />;
}

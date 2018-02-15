
/*
Meant to be immutable
*/
export default class ComponentFootprint {

  unzonedRange: any
  isAllDay: boolean = false // component can choose to ignore this
  technicianSchedule?: any

  constructor(unzonedRange, isAllDay, technicianSchedule?) {
    this.unzonedRange = unzonedRange
    this.isAllDay = isAllDay
    this.technicianSchedule = technicianSchedule
  }


  /*
  Only works for non-open-ended ranges.
  */
  toLegacy(calendar) {
    return {
      start: calendar.msToMoment(this.unzonedRange.startMs, this.isAllDay),
      end: calendar.msToMoment(this.unzonedRange.endMs, this.isAllDay)
    }
  }

}

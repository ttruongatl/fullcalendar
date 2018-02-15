import { htmlEscape } from '../util'
import Mixin from '../common/Mixin'

export interface TechnicianTableInterface {
  schedules: any
  techniciansPerRow: any
  rowCnt: any
  colCnt: any
  updateDayTable()
  renderHeadHtml()
  renderBgTrHtml(row)
  bookendCells(trEl)
  getCellTechnician(row, col)
  getCellRange(row, col)
  sliceRangeByDay(unzonedRange)
  sliceRangeByRow(unzonedRange)
  renderIntroHtml()
}

/*
A set of rendering and date-related methods for a visual component comprised of one or more rows of day columns.
Prerequisite: the object being mixed into needs to be a *Grid*
*/
export default class TechnicianTableMixin extends Mixin implements TechnicianTableInterface {

  breakOnWeeks: boolean // should create a new row for each week? not specified, so default is FALSY
  schedules: any // whole-day dates for each column. left to right
  dayIndices: any // for each day from start, the offset
  techniciansPerRow: any
  rowCnt: any
  colCnt: any
  colHeadFormat: any

  // Populates internal variables used for date calculation and rendering
  updateDayTable() {
    let t = (this as any)
    let view = t.view
    let calendar = view.calendar

    let dayIndex = -1
    let dayIndices = []
    let rowCnt

    this.schedules = calendar.scheduleSources

    // let date = this.schedules.openHours.schedule[0].start
    // let end = this.schedules.openHours.schedule[0].end
    this.schedules.rosters.forEach(roaster => {
      // loop each day from start to end
      if (!roaster.schedule[0].off) {
        dayIndices.push(dayIndex + 0.5) // mark that it's between indices
      } else {
        dayIndex++
        dayIndices.push(dayIndex)
      }
    })

    this.dayIndices = dayIndices
    this.techniciansPerRow = this.schedules.rosters.length
    this.rowCnt = rowCnt

    this.updateDayTableCols()
  }


  // Computes and assigned the colCnt property and updates any options that may be computed from it
  updateDayTableCols() {
    this.colCnt = this.computeColCnt()
    this.colHeadFormat =
      (this as any).opt('columnHeaderFormat') ||
      (this as any).opt('columnFormat') || // deprecated
      this.computeColHeadFormat()
  }


  // Determines how many columns there should be in the table
  computeColCnt() {
    return this.techniciansPerRow
  }


  // Computes the ambiguously-timed moment for the given cell
  getCellTechnician(row, col) {
    return this.schedules.rosters[
      this.getCellTechnicianIndex(row, col)
    ]
  }


  // Computes the ambiguously-timed date range for the given cell
  getCellRange(row, col) {
    let start = this.getCellTechnician(row, col).schedule[0].start
    let end = this.getCellTechnician(row, col).schedule[0].end
    return { start: start, end: end }
  }


  // Returns the number of day cells, chronologically, from the first of the grid (0-based)
  getCellTechnicianIndex(row, col) {
    return row * this.techniciansPerRow + this.getColDayIndex(col)
  }


  // Returns the numner of day cells, chronologically, from the first cell in *any given row*
  getColDayIndex(col) {
    if ((this as any).isRTL) {
      return this.colCnt - 1 - col
    } else {
      return col
    }
  }


  // Given a date, returns its chronolocial cell-index from the first cell of the grid.
  // If the date lies between cells (because of hiddenDays), returns a floating-point value between offsets.
  // If before the first offset, returns a negative number.
  // If after the last offset, returns an offset past the last cell offset.
  // Only works for *start* dates of cells. Will not work for exclusive end dates for cells.
  getDateDayIndex(date) {
    // let dayIndices = this.dayIndices
    // let dayOffset = date.diff(this.dayDates[0], 'days')

    // if (dayOffset < 0) {
    //   return dayIndices[0] - 1
    // } else if (dayOffset >= dayIndices.length) {
    //   return dayIndices[dayIndices.length - 1] + 1
    // } else {
    //   return dayIndices[dayOffset]
    // }
    return 0
  }


  /* Options
  ------------------------------------------------------------------------------------------------------------------*/


  // Computes a default column header formatting string if `colFormat` is not explicitly defined
  computeColHeadFormat() {
    // if more than one week row, or if there are a lot of columns with not much space,
    // put just the day numbers will be in each cell
    if (this.rowCnt > 1 || this.colCnt > 10) {
      return 'ddd' // "Sat"
    } else if (this.colCnt > 1) {
      return (this as any).opt('dayOfMonthFormat') // "Sat 12/10"
    } else {
      return 'dddd' // "Saturday"
    }
  }


  /* Slicing
  ------------------------------------------------------------------------------------------------------------------*/


  // Slices up a date range into a segment for every week-row it intersects with
  sliceRangeByRow(unzonedRange) {
    let daysPerRow = this.techniciansPerRow
    let normalRange = (this as any).view.computeDayRange(unzonedRange) // make whole-day range, considering nextDayThreshold
    let rangeFirst = this.getDateDayIndex(normalRange.start) // inclusive first index
    let rangeLast = this.getDateDayIndex(normalRange.end.clone().subtract(1, 'days')) // inclusive last index
    let segs = []
    let row
    let rowFirst
    let rowLast // inclusive day-index range for current row
    let segFirst
    let segLast // inclusive day-index range for segment

    for (row = 0; row < this.rowCnt; row++) {
      rowFirst = row * daysPerRow
      rowLast = rowFirst + daysPerRow - 1

      // intersect segment's offset range with the row's
      segFirst = Math.max(rangeFirst, rowFirst)
      segLast = Math.min(rangeLast, rowLast)

      // deal with in-between indices
      segFirst = Math.ceil(segFirst) // in-between starts round to next cell
      segLast = Math.floor(segLast) // in-between ends round to prev cell

      if (segFirst <= segLast) { // was there any intersection with the current row?
        segs.push({
          row: row,

          // normalize to start of row
          firstRowDayIndex: segFirst - rowFirst,
          lastRowDayIndex: segLast - rowFirst,

          // must be matching integers to be the segment's start/end
          isStart: segFirst === rangeFirst,
          isEnd: segLast === rangeLast
        })
      }
    }

    return segs
  }


  // Slices up a date range into a segment for every day-cell it intersects with.
  // TODO: make more DRY with sliceRangeByRow somehow.
  sliceRangeByDay(unzonedRange) {
    let daysPerRow = this.techniciansPerRow
    let normalRange = (this as any).view.computeDayRange(unzonedRange) // make whole-day range, considering nextDayThreshold
    let rangeFirst = this.getDateDayIndex(normalRange.start) // inclusive first index
    let rangeLast = this.getDateDayIndex(normalRange.end.clone().subtract(1, 'days')) // inclusive last index
    let segs = []
    let row
    let rowFirst
    let rowLast // inclusive day-index range for current row
    let i
    let segFirst
    let segLast // inclusive day-index range for segment

    for (row = 0; row < this.rowCnt; row++) {
      rowFirst = row * daysPerRow
      rowLast = rowFirst + daysPerRow - 1

      for (i = rowFirst; i <= rowLast; i++) {

        // intersect segment's offset range with the row's
        segFirst = Math.max(rangeFirst, i)
        segLast = Math.min(rangeLast, i)

        // deal with in-between indices
        segFirst = Math.ceil(segFirst) // in-between starts round to next cell
        segLast = Math.floor(segLast) // in-between ends round to prev cell

        if (segFirst <= segLast) { // was there any intersection with the current row?
          segs.push({
            row: row,

            // normalize to start of row
            firstRowDayIndex: segFirst - rowFirst,
            lastRowDayIndex: segLast - rowFirst,

            // must be matching integers to be the segment's start/end
            isStart: segFirst === rangeFirst,
            isEnd: segLast === rangeLast
          })
        }
      }
    }

    return segs
  }


  /* Header Rendering
  ------------------------------------------------------------------------------------------------------------------*/


  renderHeadHtml() {
    let theme = (this as any).view.calendar.theme

    return '' +
      '<div class="fc-row ' + theme.getClass('headerRow') + '">' +
      '<table class="' + theme.getClass('tableGrid') + '">' +
      '<thead>' +
      this.renderHeadTrHtml() +
      '</thead>' +
      '</table>' +
      '</div>'
  }


  renderHeadIntroHtml() {
    return this.renderIntroHtml() // fall back to generic
  }


  renderHeadTrHtml() {
    return '' +
      '<tr>' +
      ((this as any).isRTL ? '' : this.renderHeadIntroHtml()) +
      this.renderHeadDateCellsHtml() +
      ((this as any).isRTL ? this.renderHeadIntroHtml() : '') +
      '</tr>'
  }


  renderHeadDateCellsHtml() {
    let htmls = []
    let col
    let technicianNickName
    for (col = 0; col < this.colCnt; col++) {
      technicianNickName = this.getCellTechnician(0, col).technician.nickname
      htmls.push((this as any).renderHeadTechnicianCellHtml(technicianNickName))
    }

    return htmls.join('')
  }


  // TODO: when internalApiVersion, accept an object for HTML attributes
  // (colspan should be no different)
  renderHeadTechnicianCellHtml(technicianNickName, colspan, otherAttrs) {
    let t = (this as any)
    let view = t.view
    let classNames = [
      'fc-day-header',
      view.calendar.theme.getClass('widgetHeader')
    ]
    let innerHtml

    if (typeof t.opt('columnHeaderHtml') === 'function') {
      innerHtml = t.opt('columnHeaderHtml')(technicianNickName)
    } else if (typeof t.opt('columnHeaderText') === 'function') {
      innerHtml = htmlEscape(t.opt('columnHeaderText')(technicianNickName))
    } else {
      innerHtml = htmlEscape(technicianNickName)
    }
    return '' +
      '<th class="' + classNames.join(' ') + '"' +
      ((t.rowCnt) === 1 ?
        ' data-technician="' + technicianNickName + '"' :
        '') +
      (colspan > 1 ?
        ' colspan="' + colspan + '"' :
        '') +
      (otherAttrs ?
        ' ' + otherAttrs :
        '') +
      '>' +
      // if not valid, display text, but no link
      innerHtml
      +
      '</th>'
  }


  /* Background Rendering
  ------------------------------------------------------------------------------------------------------------------*/


  renderBgTrHtml(row) {
    return '' +
      '<tr>' +
      ((this as any).isRTL ? '' : this.renderBgIntroHtml(row)) +
      this.renderBgCellsHtml(row) +
      ((this as any).isRTL ? this.renderBgIntroHtml(row) : '') +
      '</tr>'
  }


  renderBgIntroHtml(row) {
    return this.renderIntroHtml() // fall back to generic
  }


  renderBgCellsHtml(row) {
    let htmls = []
    let col
    let date

    for (col = 0; col < this.colCnt; col++) {
      date = this.getCellTechnician(row, col)
      htmls.push((this as any).renderBgCellHtml(date))
    }

    return htmls.join('')
  }


  renderBgCellHtml(date, otherAttrs) {
    let t = (this as any)
    let view = t.view
    let isDateValid = t.dateProfile.activeUnzonedRange.containsDate(date) // TODO: called too frequently. cache somehow.
    let classes = t.getDayClasses(date)

    classes.unshift('fc-day', view.calendar.theme.getClass('widgetContent'))

    return '<td class="' + classes.join(' ') + '"' +
      (isDateValid ?
        ' data-date="' + date.format('YYYY-MM-DD') + '"' : // if date has a time, won't format it
        '') +
      (otherAttrs ?
        ' ' + otherAttrs :
        '') +
      '></td>'
  }


  /* Generic
  ------------------------------------------------------------------------------------------------------------------*/


  renderIntroHtml() {
    // Generates the default HTML intro for any row. User classes should override
  }


  // TODO: a generic method for dealing with <tr>, RTL, intro
  // when increment internalApiVersion
  // wrapTr (scheduler)


  /* Utils
  ------------------------------------------------------------------------------------------------------------------*/


  // Applies the generic "intro" and "outro" HTML to the given cells.
  // Intro means the leftmost cell when the calendar is LTR and the rightmost cell when RTL. Vice-versa for outro.
  bookendCells(trEl) {
    let introHtml = this.renderIntroHtml()

    if (introHtml) {
      if ((this as any).isRTL) {
        trEl.append(introHtml)
      } else {
        trEl.prepend(introHtml)
      }
    }
  }

}

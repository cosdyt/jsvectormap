import Util from './Util/Util'
import Defaults from './Defaults/Index'
import SVGCanvasElement from './SVG/CanvasElement'
import * as MapPrototypes from './Map/Index'
import Events from './Defaults/Events'
import EventHandler from './EventHandler'

/**
 * ------------------------------------------------------------------------
 * Class Definition
 * ------------------------------------------------------------------------
 */
class Map {
  constructor(options = {}) {

    // Merge the given options with the default options
    this.params = Util.merge(Map.defaults, options)

    // Throw an error if the given map name doesn't match
    // the map that was set in map file
    if (!Map.maps[this.params.map]) {
      throw new Error('Attempt to use map which was not loaded: ' + options.map)
    }

    this.mapData = Map.maps[this.params.map]

    this.regionsData = {}
    this.regionsColors = {}
    this.markers = {}

    this.defaultWidth = this.mapData.width
    this.defaultHeight = this.mapData.height

    this.height = 0
    this.width = 0

    this.scale = 1
    this.baseScale = 1
    this.transX = 0
    this.transY = 0
    this.baseTransX = 0
    this.baseTransY = 0
    this.regions = {}

    // `document` is already ready, just initialise now
    if (window.document.readyState !== 'loading') {
      this.init(options.selector)
    } else {
      // Wait until `document` is ready
      window.addEventListener('DOMContentLoaded', this.init.bind(
        this, options.selector
      ))
    }
  }

  // Initialize the map
  init(selector) {
    // @TODO: We can get the selector from params `this.params.selector` but unfortunately
    // when passing a DOM element to jsVectorMap constructor, the DOM element doesn't get merged
    // with defaults during merging the options so we need to get the selector directly from the options.
    this.container = Util.$(selector).addClass('jsvmap-container')

    this.canvas = new SVGCanvasElement(
      this.container, this.width, this.height
    )

    // Set the map's background color
    this.setBackgroundColor(this.params.backgroundColor)

    // Handle the container
    this.handleContainerEvents()

    // Create regions/markers, then handle events for both
    this.createRegions()

    // Update size
    this.updateSize()

    // Create markers
    this.createMarkers(this.params.markers || {})

    // Create toolip
    if (this.params.showTooltip) {
      this.createTooltip()
    }

    // Create zoom buttons if zoomButtons is set to true
    if (this.params.zoomButtons) {
      this.handleZoomButtons()
    }

    // Set selected regions if passed
    if (this.params.selectedRegions) {
      this.setSelected('regions', this.params.selectedRegions)
    }

    // Set selected regions if passed
    if (this.params.selectedMarkers) {
      this.setSelected('markers', this.params.selectedMarkers)
    }

    // Set focus on a spcific region
    if (this.params.focusOn) {
      this.setFocus(this.params.focusOn)
    }

    // Bind touch events if true
    if (this.params.bindTouchEvents) {
      if (('ontouchstart' in window) || (window.DocumentTouch && document instanceof DocumentTouch)) {
        this.bindContainerTouchEvents()
      }
    }

    // Handle regions/markers events
    this.handleElementEvents()

    // Position labels
    this.repositionLabels()

    // Handle legends
    this.container.append(
      this.legendHorizontal = Util.createEl(
        'div', 'jsvmap-series-container jsvmap-series-h'
      )
    ).append(
      this.legendVertical = Util.createEl(
        'div', 'jsvmap-series-container jsvmap-series-v'
      )
    )

    // Create series if passed
    if (this.params.series) {
      this.createSeries()
    }

    // Fire loaded event
    this.emit('map:loaded', [this])
  }

  // Public

  emit(eventValue, args) {
    for (let event in Events) {
      if (Events[event] === eventValue && Util.isFunc(this.params[event])) {
        this.params[event].apply(this, args)
      }
    }
  }

  setBackgroundColor(color) {
    this.container.css({ backgroundColor: color })
  }

  getInsetForPoint(x, y) {
    var index, bbox, insets = Map.maps[this.params.map].insets

    for (index = 0; index < insets.length; index++) {
      bbox = insets[index].bbox

      if (x > bbox[0].x && x < bbox[1].x && y > bbox[0].y && y < bbox[1].y) {
        return insets[index]
      }
    }
  }

  // Markers/Regions
  getSelected(type) {
    let key, selected = []

    for (key in this[type]) {
      if (this[type][key].element.isSelected) {
        selected.push(key)
      }
    }

    return selected
  }

  clearSelected(type) {
    this.getSelected(type).forEach(i => {
      this[type][i].element.deselect()
    })
  }

  setSelected(type, keys) {
    keys.forEach(key => {
      if (this[type][key]) {
        this[type][key].element.select()
      }
    })
  }

  // Region methods
  getSelectedRegions() {
    return this.getSelected('regions')
  }

  clearSelectedRegions() {
    this.getSelected('regions').forEach(code => {
      this.regions[code].element.deselect()
    })
  }

  // Markers methods
  getSelectedMarkers() {
    return this.getSelected('markers')
  }

  clearSelectedMarkers() {
    this.getSelected('markers').forEach(index => {
      this.markers[index].element.deselect()
    })
  }

  addMarker(code, config) {
    this.createMarkers({ [code]: config }, true)
  }

  removeMarkers(markers) {
    markers.forEach(index => {
      // Remove the element from the DOM
      this.markers[index].element.remove()
      // Remove the element from markers object
      delete this.markers[index]
    })
  }

  // Reset map
  reset() {
    for (let key in this.series) {
      for (let i = 0; i < this.series[key].length; i++) {
        this.series[key][i].clear()
      }
    }

    this.scale = this.baseScale
    this.transX = this.baseTransX
    this.transY = this.baseTransY

    this.clearSelectedMarkers()
    this.clearSelectedRegions()
    this.applyTransform()
  }

  // Destroy the map
  destroy(destroyInstance = true) {
    const eventRegistry = EventHandler.getEventRegistry()
    const tooltip = this.tooltip.selector
    const keys = Object.keys

    // Remove tooltip from the DOM
    tooltip.parentElement.removeChild(tooltip)

    // Remove event registry
    keys(eventRegistry).forEach(event => {
      EventHandler.off(eventRegistry[event].selector, event, eventRegistry[event].handler)
    })

    // For perfomance issues remove all possible properties
    if (destroyInstance) {
      keys(this).forEach(key => {
        try {
          delete this[key]
        } catch (e) {}
      })
    }
  }

}

Map.maps = {}
Map.defaults = Defaults
Object.assign(Map.prototype, MapPrototypes)

export default Map

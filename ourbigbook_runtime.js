// https://docs.ourbigbook.com#insane-link-parsing-rules

// We got these to work perfectly at one point with webpack style-loader.
// But we just want the separate .css.
//import "./ourbigbook.scss";
//import "katex/dist/katex.min.css";
//import "normalize.css/normalize.css";

// With import gave Uncaught ReferenceError: Tablesort is not defined
// but this worked https://github.com/tristen/tablesort/issues/165
const Tablesort = require('tablesort')
if (typeof window !== 'undefined') {
  window.Tablesort = Tablesort
  require('tablesort/src/sorts/tablesort.date.js')
  require('tablesort/src/sorts/tablesort.dotsep.js')
  require('tablesort/src/sorts/tablesort.filesize.js')
  require('tablesort/src/sorts/tablesort.monthname.js')
  require('tablesort/src/sorts/tablesort.number.js')
}

let myDocument
const SELFLINK_CLASS = 'selflink'

// TODO CSS variable duplication.
// max-mobile-width
const CSS_MAX_MOBILE_WIDTH = 635

// toplevel: if given, is an Element (not document) under which OurBigBook Marktup runtime will take effect.
export function ourbigbook_runtime(toplevel) {
  if (toplevel === undefined) {
    toplevel = document;
    myDocument = document
  } else {
    myDocument = toplevel.ownerDocument
  }

  if (
    window.ourbigbook_split_headers &&
    window.location.hash &&
    !window.location.hash.startsWith(':~:text=')
  ) {
    const hash = window.location.hash.substring(1)
    if(!myDocument.getElementById(hash)) {
      const dest = window.ourbigbook_redirect_prefix + hash + (window.ourbigbook_html_x_extension ? '.html' : '')
      window.location.replace(dest)
    }
  }

  // ToC interaction.
  const CLOSE_CLASS = 'close';
  const TOC_CONTAINER_CLASS = 'toc-container';
  const toc_arrows = toplevel.querySelectorAll(`.${TOC_CONTAINER_CLASS} div.arrow`);
  for (const toc_arrow of toc_arrows) {
    toc_arrow.addEventListener('click', () => {
      // https://docs.ourbigbook.com#table-of-contents-javascript-open-close-interaction
      const parent_li = toc_arrow.parentElement.parentElement;
      let all_children_closed = true;
      let all_children_open = true;
      let was_open;
      if (parent_li.classList.contains(CLOSE_CLASS)) {
        was_open = false;
        // Open self.
        parent_li.classList.remove(CLOSE_CLASS);
      } else {
        was_open = true;
        // Check if all children are closed.
        for (const toc_arrow_child of parent_li.childNodes) {
          if (toc_arrow_child.tagName === 'UL') {
            for (const toc_arrow_child_2 of toc_arrow_child.childNodes) {
              if (toc_arrow_child_2.tagName === 'LI') {
                if (toc_arrow_child_2.classList.contains(CLOSE_CLASS)) {
                  all_children_open = false;
                } else if (toc_arrow_child_2.classList.contains('has-child')) {
                  all_children_closed = false;
                }
              }
            }
          }
        }
      }
      for (const toc_arrow_child of parent_li.childNodes) {
        if (toc_arrow_child.tagName === 'UL') {
          for (const toc_arrow_child_2 of toc_arrow_child.childNodes) {
            if (toc_arrow_child_2.tagName === 'LI') {
              if (!was_open || (was_open && !all_children_closed)) {
                toc_arrow_child_2.classList.add(CLOSE_CLASS);
              } else {
                toc_arrow_child_2.classList.remove(CLOSE_CLASS);
              }
            }
          }
        }
      }
    });
  }

  // Open ToC when jumping to it from header.
  const h_to_tocs = toplevel.getElementsByClassName('ourbigbook-h-to-toc');
  for (const h_to_toc of h_to_tocs) {
    h_to_toc.addEventListener('click', () => {
      let cur_elem = myDocument.getElementById(h_to_toc.getAttribute('href').slice(1)).parentElement;
      while (!cur_elem.classList.contains(TOC_CONTAINER_CLASS)) {
        cur_elem.classList.remove(CLOSE_CLASS);
        cur_elem = cur_elem.parentElement;
      }
    });
  }

  // Video click to play.
  // https://github.com/ourbigbook/ourbigbook/issues/122
  const videos = toplevel.getElementsByTagName('video');
  for(const video of videos) {
    const parentNode = video.parentNode;
    let first = true;
    video.addEventListener('click', () => {
      if (first) {
        video.play();
      }
      first = false;
    });
  }

  // tablesort
  const tables = toplevel.getElementsByTagName('table');
  for(const table of tables) {
    new Tablesort(table);
  }

  // Set repetitive titles from Js to save HTML space.
  // On hover things make 0 difference to user experience basically, so it is a no brainer,
  // the only concern is slowing down Js.
  function setTitles(selector, title) {
    const elems = toplevel.querySelectorAll(`.${TOC_CONTAINER_CLASS} ${selector}`);
    for (const elem of elems) {
      elem.title = title
    }
  }
  setTitles('.c', 'link to this ToC entry')
  setTitles('.u', 'parent ToC entry')
  for (const e of toplevel.querySelectorAll('span.wcntr')) {
    e.title = 'word count for this article + all descendants'
  }
  for (const e of toplevel.querySelectorAll('span.wcnt')) {
    e.title = 'word count for this article'
  }
  for (const e of toplevel.querySelectorAll('span.dcnt')) {
    e.title = 'descendant article count'
  }
  for (const e of toplevel.querySelectorAll('a.split')) {
    e.title = 'view one header per page'
  }
  for (const e of toplevel.querySelectorAll('a.nosplit')) {
    e.title = 'view all headers in a single page'
  }
  for (const e of toplevel.querySelectorAll('.h-nav .toc')) {
    e.title = 'table of contents entry for this header'
  }
  for (const e of toplevel.querySelectorAll('.h-nav .u')) {
    // .u for Up
    e.title = 'parent header'
  }
  for (const e of toplevel.querySelectorAll('.h-nav .wiki')) {
    e.title = 'Wikipedia article about the same topic as this header'
  }
  for (const e of toplevel.querySelectorAll('.h-nav .tags')) {
    e.title = 'tags this header is tagged with'
  }

  // On-hover links.
  for (const elem of toplevel.querySelectorAll('.ourbigbook > *')) {
    if (elem.id) {
      elem.addEventListener('mouseenter', (e) => {
        if (CSS_MAX_MOBILE_WIDTH < window.innerWidth) {
          const a = myDocument.createElement('a')
          a.href = `#${e.target.id}`
          a.className = SELFLINK_CLASS
          e.target.prepend(a)
        }
      })
      elem.addEventListener('mouseleave', (e) => {
        const t = e.target
        const firstChild = t.children[0]
        if (
          // Not sure why but this could be undefined on OurBigBook Web
          // when clicking from e.g. /go/articles to an article and hovering
          // off from the element that you were hoevered on to by the page change.
          // Would be good to understand better, but no patiecnse now.
          firstChild !== undefined &&
          firstChild.className === SELFLINK_CLASS
        ) {
          t.removeChild(firstChild)
        }
      })
    }
  }

  // JsCanvasDemo
  const ourbigbook_canvas_demo_elems = toplevel.getElementsByClassName('ourbigbook-js-canvas-demo');
  const ourbigbook_canvas_demo_weakmap = new WeakMap();
  for (const ourbigbook_canvas_demo_elem of ourbigbook_canvas_demo_elems) {
    ourbigbook_canvas_demo_weakmap.set(ourbigbook_canvas_demo_elem, false);
    const observer = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach(entry => {
          if (entry.intersectionRatio > 0.0) {
            if (!ourbigbook_canvas_demo_weakmap.get(ourbigbook_canvas_demo_elem)) {
              ourbigbook_canvas_demo_weakmap.set(ourbigbook_canvas_demo_elem, true);
              eval(ourbigbook_canvas_demo_elem.childNodes[0].textContent).do_init(ourbigbook_canvas_demo_elem);
            }
          }
        });
      },
      {}
    )
    observer.observe(ourbigbook_canvas_demo_elem);
  }
}

// Load required scripts dynamically:
//
// * https://stackoverflow.com/questions/7308908/waiting-for-dynamically-loaded-script/57267538#57267538
// * https://stackoverflow.com/questions/14521108/dynamically-load-js-inside-js/14521482#14521482
// * https://stackoverflow.com/questions/10004112/how-can-i-wait-for-set-of-asynchronous-callback-functions
//
// We use to reduce the initial load time.
//
// Each script is loaded only once after it has finished loading for the first time,
// even if this function is called multiple times.
async function ourbigbook_load_scripts(script_urls) {
  function load(script_url) {
    return new Promise(function(resolve, reject) {
      if (ourbigbook_load_scripts.loaded.has(script_url)) {
        resolve();
      } else {
        var script = myDocument.createElement('script');
        script.onload = resolve;
        script.src = script_url
        myDocument.head.appendChild(script);
      }
    });
  }
  var promises = [];
  for (const script_url of script_urls) {
    promises.push(load(script_url));
  }
  await Promise.all(promises);
  for (const script_url of script_urls) {
    ourbigbook_load_scripts.loaded.add(script_url);
  }
}
ourbigbook_load_scripts.loaded = new Set();

// Create some nice controls for a canvas demo!
// TODO currently disabled on HTML because it would cause reflows on lower IDs.
// What we should do instead, is to only add the new elements on hover, this
// keeps thing simple, but still works.
class OurbigbookCanvasDemo {
  addInputAfterEnable(label, attributes) {
    var input = document.createElement('input');
    for (var key in attributes) {
      input.setAttribute(key, attributes[key]);
    }
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(label + ': '));
    div.appendChild(input);
    this.enable_div.parentNode.insertBefore(div, this.enable_div.nextSibling);
    return input;
  }

  addInfoSpanAfterEnable(label) {
    var span = document.createElement('span');
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(label + ': '));
    div.appendChild(span);
    this.enable_div.parentNode.insertBefore(div, this.enable_div.nextSibling);
    return span;

  }

  animate() {
    var fps_limit = parseFloat(this.fps_limit_input.value);
    if (!isNaN(fps_limit)) {
      var fps_limit_time_millis = 1000.0 / fps_limit;
      var now = Date.now();
      var fps_limit_elapsed = now - this.fps_limit_then;
    }
    if (isNaN(fps_limit) || (fps_limit_elapsed > fps_limit_time_millis)) {
      if (!isNaN(fps_limit)) {
        this.fps_limit_then = now - (fps_limit_elapsed % fps_limit_time_millis);
      }
      this.resizeCanvas();
      this.draw();

      // Save the images to files.
      // https://stackoverflow.com/questions/19235286/convert-html5-canvas-sequence-to-a-video-file/57153718#57153718
      if (this.save_images_input.checked) {
        this.canvas.toBlob(this.constructor.createBlobFunc(this.demo_id, this.time));
      }
      this.time++;
      this.total_frames_span.innerHTML = this.time.toString();

      /* FPS calculation. */
      var fps_granule = parseInt(this.fps_granule_input.value);
      if (this.time % fps_granule == 0) {
        var fps_date = Date.now();
        this.fps_span.innerHTML = (1000.0 * fps_granule / (fps_date - this.fps_last_date)).toFixed(2);
        this.fps_last_date = fps_date;
      }
    }
    if (this.enable_input.checked) {
      window.requestAnimationFrame(this.animate.bind(this));
    }
  }

  // We need this to fix time because toBlob calls are asynchronous.
  static createBlobFunc(demo_id, time) {
    return (blob) => {
      // From FileSaver.js.
      saveAs(blob, `canvas-${demo_id}-${time}.png`);
    };
  }

  // Do the actual drawing.
  draw() {
    throw new Error('unimplemented');
  }

  // Change the state from the old to the new.
  //
  // If it was disabled and now became enabled, start the animation.
  //
  // async because it may do long async steps like loading external libraries
  // on the first enable.
  async enableStateChange(new_state, old_state) {
    if (new_state) {
      if (!old_state) {
        this.enable_input.checked = true;
        if (!this.init_done) {
          await ourbigbook_load_scripts(['https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/1.3.8/FileSaver.min.js']);
          this.init_done = true;
        }
        console.log(`${this.myclass} starting: ${this.demo_id}`);
        window.requestAnimationFrame(this.animate.bind(this));
      }
    } else {
      if (old_state) {
        console.log(`${this.myclass} stopping: ${this.demo_id}`);
        this.enable_input.checked = false;
      }
    }
  }

  do_init(demo_element) {
    this.demo_element = demo_element;
    this.init();
  }

  init(demo_id, options) {
    this.demo_id = demo_id;
    this.options = Object.assign({}, options);
    if (!('enabled' in this.options)) {
      this.options.enabled = false;
    }
    if (!('context_type' in this.options)) {
      this.options.context_type = '2d';
    }

    // Members.
    this.time = 0;

    // Random variables.
    // https://stackoverflow.com/questions/19764018/controlling-fps-with-requestanimationframe
    this.fps_limit_then = Date.now();
    this.fps_last_date = new Date();

    // HTML.
    const canvas_wrapper = document.createElement('div');
    this.myclass = 'canvas-demo'
    canvas_wrapper.setAttribute('class', this.myclass);

    // Enable disable.
    this.enable_input = document.createElement('input');
    this.enable_input.setAttribute('type', 'checkbox');
    this.enable_input.setAttribute('value', '5');
    this.enable_input.setAttribute('min', '1');
    this.enable_input.addEventListener('change', async () => {
      this.enableStateChange(this.enable_input.checked, !this.enable_input.checked);
    });
    const enable_label = document.createElement('label');
    enable_label.appendChild(document.createTextNode('Enable: '));
    enable_label.appendChild(this.enable_input);
    enable_label.appendChild(document.createTextNode('<-- (click this to run!!!)'));
    this.enable_div = document.createElement('div');
    this.enable_div.appendChild(enable_label);
    canvas_wrapper.appendChild(this.enable_div);

    // All inputs and info entries.
    this.fps_span = this.addInfoSpanAfterEnable('FPS');
    this.total_frames_span = this.addInfoSpanAfterEnable('Total frames');
    this.fps_granule_input = this.addInputAfterEnable(
      'FPS granule',
      {
        'min': '1',
        'type': 'number',
        'value': '5'
      }
    );
    this.fps_limit_input = this.addInputAfterEnable(
      'FPS limit',
      {
        'min': '1',
        'type': 'number'
      }
    );
    this.save_images_input = this.addInputAfterEnable(
      'Save images',
      {
        'type': 'checkbox',
      }
    );
    this.canvas_width_input = this.addInputAfterEnable(
      'canvas width',
      {
        'min': '1',
        'type': 'number',
        'value': '128'
      }
    );

    // Canvas.
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('style', 'border:1px solid black;');
    canvas_wrapper.appendChild(this.canvas);
    this.ctx = this.canvas.getContext(this.options.context_type);
    this.resizeCanvas();

    // Add the canvas_wrapper.
    this.demo_element.parentNode.insertBefore(
      canvas_wrapper, this.demo_element
    );

    // Auto enable animations when they come into the viewport,
    // and disable them when they leave the viewport!!!
    //
    // This is done to prevent JavaScript animations from slowing the page down too much,
    // while still not requiring the user to click to enable all of them all the time.
    //
    // If the user explicitly disables then once, they are not automatically enabled anymore.
    //
    // https://stackoverflow.com/questions/123999/how-to-tell-if-a-dom-element-is-visible-in-the-current-viewport/15203639#15203639
    this.first_observer_init = true;
    const observer = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach(entry => {
          if (entry.intersectionRatio > 0.0) {
            // Just entered the viewport.
            if (this.first_observer_init) {
              this.first_observer_init = false;
              this.enableStateChange(true, this.enable_input.checked);
            }
          } else {
            // Just left the viewport.
            this.enableStateChange(false, this.enable_input.checked);
          }
        });
      },
      {}
    )
    observer.observe(canvas_wrapper);

    // Finish initialization.
    this.init_done = false;
    this.enableStateChange(this.options.enabled, this.enable_input.checked);
  }

  resizeCanvas() {
    const canvas_width = parseInt(this.canvas_width_input.value);
    if (isNaN(canvas_width)) {
      canvas_width = parseInt(this.canvas_width_input.getAttribute('value'));
    }
    this.canvas.width = canvas_width;
    this.canvas.height = canvas_width;
    this.width = canvas_width
    this.height = canvas_width
  }
}


/* Workflow editor:
   Edit a visual workflow and provides its representation as a JSON S-expression
*/

/* blockTypeList so far so good */
const BlockTypeList = {

   init: function() {
      this.list =  Object.create(Collection).init(); //blockType objects
      this.display = $(accordion);
      return this;
   },

   initBlocks: function() {

      let numBlock = 0;
      let block;

      for (block in predefined_gui) {

         const defGUI = predefined_gui[block];

         if (defGUI.hasOwnProperty("group")) {
            // the block is a group
            debugMsg("found group of ", block);

            // position and add the block
            this.addBlockGroup(block, defGUI, numBlock );
         }
         else {
            // the block is stand-alone
            // position and add the block
            this.addBlockType(block, defGUI, numBlock);
         }
      }
   },

   addSection: function(section) {
      if (!section) section = 'Other';
      debugMsg("getting or making section ",section);

      let sectionElt = $("#"+section);
      if (!sectionElt.length) {
         debugMsg("section not found, adding");
         this.display.append("<h3>"+section+"</h3>");
         sectionElt = $('<div>').attr("id",section);
         this.display.append(sectionElt);
      }

      return sectionElt;
   },

   addBlockGroup: function (label, defGUI, position) {
      /* eg
         label "logic"
         defgui {"args": 2, "group": { "or": {}, "and": {} } }
      */

      debugMsg("adding group ", label, defGUI);

      // block is for a group with drop down option
      const arr = {}; // arr - array to collect expression for each item
      let allHaveExp = true; // flag whether all items have a getExp
      let bc = "<form><select>";
      for (let g in defGUI.group) {
         const ghtml = document.createElement('div').appendChild(document.createTextNode(g)).parentNode.innerHTML; // vulnerable see SO html encoding
         bc += '<option value="'+ghtml+'">'+ghtml+'</option>';
         if (defGUI.group[g].getExp)
            arr[g] = defGUI.group[g].getExp;
         else
            allHaveExp = false;
      }
      bc += "</select></form>";

      if (defGUI.blockCode)
         defGUI.blockCode = bc + defGUI.blockCode;
      else
         defGUI.blockCode = bc;

      // working out getExp - the code to work out the correct block expression
      let newGetExp = "";
      if (Object.keys(arr).length == 0) {
         if (defGUI.getExp)
            newGetExp = defGUI.getExp
         else
            newGetExp = "return block.find('form > select').val();"
      }
      else {
         newGetExp = "let op = block.find('form > select').val(); ";
         newGetExp += "let arr = "+JSON.stringify(arr)+"; ";
         if (allHaveExp) {
            newGetExp += "eval('function f() {'+arr[op]+';}');";
            newGetExp += "return f();"
         }
         else if (defGUI.getExp) {
            newGetExp += "let fb = arr[op]?arr[op]:"+defGUI.getExp;
            newGetExp += "eval('function f() {'+fb+';}');";
            newGetExp += "return f();";
         } else {
            newGetExp += "if (arr[op]) {";
            newGetExp += "eval('function f() {'+arr[op]+';}');";
            newGetExp += "return f();";
            newGetExp += "} else";
            newGetExp += "return op;";
         }
      }
      defGUI.getExp = newGetExp;

      // delete defGUI.group;

      this.addBlockType(label, defGUI, position);

   },

   addBlockType: function(label, defGUI, position) {
      const section = this.addSection(defGUI.label);
      Object.create(BlockType).init(label, defGUI).addTo(position,section); //add blocktype to accordion
   },

   removeBlockType: function(label) {
      const bT = this.get(label);
      this.display.remove(bT.element);
      this.remove(label);
   },

   remove: function (lbl) {
      if (this.list.remove(lbl))
         return this
      else
         return false;
   },

   get: function(label) {
      debugMsg("Getting from blockTypeList ",label);
      return this.list.get(label);
   },

   clear: function() {
      this.list.clear();
      return this;
   },

   empty: function() {
      return (this.list.empty());
   },

   contains: function(lbl) {
      return this.list.contains(lbl);
   },

   add: function (lbl,e) {
      debugMsg("adding",lbl);
      if (this.list.add(lbl,e)) return false;
      return this;
   },

   set: function (lbl,e) {
      this.list.set(lbl,e);
      return this;
   },

   removeAll: function (lbls) {
      return lbls.map(this.remove);
   },

   size: function() {
      return this.list.length;
   },

   map: function(f) {
      return this.list.map(f);
   }

}

const PipeInstance = {

   init: function(element,owner) {
      debugMsg("enabling plumbing","owner",owner?(owner.name):"unknown");
      this.canvas = element; // the document element to attach blocks to
      this.plumber = jsPlumb.getInstance(this.canvas); // jsPlumb instance - see jsPlumb API
      this.idNum = 0; // for generating the ID of blocks in use in this pipe
      this.tokenList = Object.create(Collection).init(); // for generating the list of tokens
      this.defunList = Object.create(Collection).init(); // for generating the list of defuns
      this.blockSelection = Object.create(Bag).init(); // list of blocks selected for interaction
      this.blockList = Object.create(Collection).init(); // all block objects on this pipe
      this.useDefaultArguments = true; // used to swap arguments when debugging custom blocks
      this.owner = owner; // owner is the editor for custom blocks, null otherwise

      const self = this;
      this.plumber.bind("connection", function(info) {
         debugMsg('connecting ', info.sourceEndpoint.getUuid(),'to ', info.targetEndpoint.getUuid());
         self.save();
      });
      this.plumber.bind("connectionDetached", function(info) {
         debugMsg('detaching ', info.sourceEndpoint.getUuid(),'from ', info.targetEndpoint.getUuid());
         self.save();
      });
      element.click(function(e) {
        // If the click was not inside the active span
        debugMsg("click");
        if(!$(e.target).hasClass('blockSelected')) {
          //e.stopPropagation();
          debugMsg("canvas clicked");
          self.deselectAllBlocks();
          self.setFocus();
          stateStore.updateFocus();
        }
      });

     return this;
   },

   setFocus: function() {
      focusPipe = this;
      const name = (this.owner)?this.owner.name:null
      stateStore.updateFocus(name);
      return this;
   },

   hasFocus: function() {
      return (focusPipe === this);
   },


   /* addBlock: create a new block of the given type.
      the attributes within blockType provide all the data to customise the block.
      return the block added
   */
   addBlock: function (elt, pos) {
      debugMsg("Adding a block at position ", pos, " element ", elt.html() )
      const typeName = elt.html().split("<")[0];

      return this.addBlockByName(typeName,pos);
   },

   addBlockByName: function (typeName, pos, id) {
      const realType = blockTypeList.get(typeName);

      debugMsg("adding block to pipe");
      const b = Object.create(BlockInstance).init(realType, this, pos, id);

      this.blockList.add(b.id, b);

      this.save();

      return b;
   },

   removeBlock: function(block) {
      debugMsg("removing",block.id);
      this.plumber.detachAllConnections(block.element);
      this.plumber.removeAllEndpoints(block.element);
      // ***should also clean up the endpoint objects?
      this.plumber.detach(block.element);
      this.deselectBlock(block);
      this.blockList.remove(block.id);
      block.remove();
      this.save();
   },

   removeAllBlocks: function() {
      debugMsg("wiping mainpipe");
      for (let bID in this.blockList.list) {
         if (bID != 'end')
            this.removeBlock(this.blockList.get(bID));
      }
   },

   /* adding the 'endBlock'. Unlike others,
      it has no output endpoint; it also cant be removed from the canvas.
      this would be best organised with inheritance. Not done yet.
   */
   addEndBlock: function (inCustomBlock) {
      // inCustomBlock - not in use
      const blockID = 'end';
      const block = $('<div>').attr('id',blockID);
      this.blockList.add(blockID, this);
      this.type = {id: 'end'};

      this.canvas.append(block);
         block.addClass('block').text('End');
         block.css({bottom:10, right:10});
         this.plumber.addEndpoint(block, {
            anchors:[0,0.5,-1,0],
            uuid: "end_in0",
            isTarget: true,
            maxConnections: 1
         }, config.connectStyle);

      const self = this;
      $(block).click(function(e) {
         e.stopPropagation();
         self.blockSelection.clear();
         self.displayExpression(blockID);
      });
   },

   // output function to view the expression for a block
   displayExpression: function (blockID) {
      changeSExp(this.getFullExpression(blockID));
      this.save();
   },

   getFullExpression: messagerise(function (blockID,defName='') {
      this.tokenList.clear();
      this.defunList.clear();
      // debugMsg(this.blockList);

      let exp;

      // the 'end' block is recursed from but never into.
      if (blockID==='end' || blockID==='block-dialog' ) {
         debugMsg("end block");
         const connections = this.plumber.getConnections({ target:blockID });
         if (connections.length==0) return null;
         exp =  this.getExpression(connections[0].sourceId);
      }
      else exp = this.getExpression(blockID);
      /**** are theree `` backticks to sanitise?? *****/

      debugMsg("Exp before defs",exp);
      // let elements = Object.create(Bag).init();
      if (this.defunList.empty() && this.tokenList.empty()) {
         debugMsg("No defs no tokens");
         return exp;
      }
      debugMsg("Some defs or tokens",this.defunList,this.tokenList);
      const env = {};
      for (let id in this.defunList.list) {
         if (id!=defName) { // defName is this function: no need to add to environment in that case
            debugMsg("adding def for ",id);
            env[id] = this.defunList.get(id);
         }
      }
      for (let id in this.tokenList.list) {
         if (id!=defName) {
            debugMsg("adding token for ",id);
            env[id] = this.tokenList.get(id);
         }
      }
      exp = ["`let`", env, exp];
      return exp;
   }),

   getExpression: messagerise(function (blockID) {
      debugMsg("seeking expression for ",blockID);
      const block = this.blockList.get(blockID);
      
      // argument and editing the definition: use default value
      if (this.useDefaultArguments&&block.type.label==='Argument') {
         debugMsg("Substituting argument name for default value");
         return 0;
      }

      // Connections is the list of connections that target this block
      // jsPlumb does not offer a method for filtering this by endPoint.
      const connections = this.plumber.getConnections({ target:blockID });
      debugMsg(connections.length, "connections found");

      // exp is the expression contained in the current block.

      const exp = block.getExpression();

      debugMsg("Raw expression is", exp)

      if (exp=="`block`") {
         debugMsg("found block",exp,block.type.label);
         debugMsg("use block");
         // find if there's a connection for t input, use if yes, null if not
         debugMsg("checking input");
         const b = (connections.length>0)?this.blockList.get(connections[0].sourceId).getExpression():null;
         debugMsg("found the name of the block: ",b);
         this.checkAddCustomFunction(b);
         return b;
      }

      if (exp == "`assign`") {

         // set the token value according to the expression connected source
         // or to null if there is none
         if (!this.tokenList.contains(blockID)) {
            const val = (connections.length>0)?this.getExpression(connections[0].sourceId):null;
            this.tokenList.add(blockID,val);
            // const environment = {}
            // environment[blockID] = val
            // return ["`let`", environment];
         }

         if (this.tokenList.contains(blockID)) return "`"+blockID+"`";

      }

      // inputs is the list of Input endPoints for the block
      const inputs = block.inPoints;

      if (exp == "`lambda`") {
         const paramSource = inputs.get(0).findConnectedSource(connections);
         const paramList = paramSource?this.getExpression(paramSource):[];
         const bodySource = inputs.get(1).findConnectedSource(connections);
         const bodyExp = bodySource?this.getExpression(bodySource):null;
         return ["`lambda`", paramList,bodyExp];
      }

      const customFunction = this.checkAddCustomFunction(exp)

      if (customFunction && (inputs.size()==0)) return ["`app`", exp];

      if (inputs.size()>0) {
         let result = ["`app`"]
         result.push(exp);
         for (let i = 0; i<inputs.size(); i++) {
            // iterate through inputs
            // find if theres a connection for each input, use if yes, null if not
            debugMsg("checking input",i);
            const source = inputs.get(i).findConnectedSource(connections);
            const e = source?this.getExpression(source):null;
            result.push(e);
         }
         return result;
      }

      return exp;

   },"Got expression:"),

   save: function() {
      if (stateStore.saving) {
         stateStore.updateCurrentPipe(this.getJSON(),this.owner);
      }
   },

   getJSON: function() {
      /* serialise the pipe into a JSON structure for saving
         Structure: {blocks: Array, args: int, connections: Array}
         - array of blocks, each contains block description, in an array: [label, position, state]
         (state is data of block form, see blockInstance.getJSON)
         - array of connections contains pairs [source,target]
         (source and target being the UUID of the endpoint connected
      */
      const blocks = [];
      const argList = [];
      const result = {};
      let args = 0;
      for (let bID in this.blockList.list) {
         if (bID!='end' && bID!='block-dialog' ) {
            const b = this.blockList.get(bID);
            if (b.isArg()) {
               argList.push(b.getJSON());
               args++;
            }
            else {
               blocks.push(b.getJSON());
            }
         }
      }

      result.blocks = argList.concat(blocks);
      result.args = args;

      const connections = {}
      this.plumber.getConnections().map(
         conn => {
            const epout = conn.endpoints[0].getUuid(),
                  epin = conn.endpoints[1].getUuid();
            debugMsg("Connecting", epout, "to", epin);
            connections[epin]=epout;
         }
      );
      
      result.connections = connections;

      if (this.owner) {
         result.size = this.owner.getSize();
         debugMsg("storing editor size:",result.size);
      }

      return result; // {blocks:argList.concat(blocks), args:args, connections:connections};
   },

   setArgsFromJSON: function(pipeData) {
      const pb = pipeData.blocks;
      const nArgs = pipeData.args;
      for (let i=0; i<nArgs; i++) {
            const bd = pb[i];
            debugMsg('adding old Arg', bd);
            const newB = this.addBlockByName(bd.type,bd,bd.id);
            newB.setState(bd);
      }
   },

   setExpFromJSON: function(pipeData) {
      try {
         const pb = pipeData.blocks;
         for (let i=pipeData.args; i<pb.length; i++) {
               const bd = pb[i];
               debugMsg('adding old block', bd);
               const newB = this.addBlockByName(bd.type,bd,bd.id);
               newB.setState(bd);
         }
         const pc = pipeData.connections;
         for (let epin in pc) {
            const epout = pc[epin];
            debugMsg("Connecting", epout, "to", epin);
            this.plumber.connect({uuids:[epout,epin]});         
         }
         if (this.owner) {
            debugMsg("recording function"); 
            this.owner.done();
         }
      }
      catch (e) {
         console.error(e);
      }
   },

   setFromJSON: function(pipeData) {
      // pipeData is serialised pipe in JSON
      this.setArgsFromJSON(pipeData);
      this.setExpFromJSON(pipeData);
   },

   // Generate a unique ID for each block in this pipe
   // Avoiding IDs already attributed
   nextID: function () {
      let result = 'id'+this.idNum;
      this.idNum++;
      if (this.blockList.contains(result)) {
         result = this.nextID();
      }
      return result;
   },

   selectBlock: function (block) {
      debugMsg("selecting block",block.id);
      this.blockSelection.queue(block);
   },

   deselectBlock: function (block) {
      debugMsg("Deselecting block",block.id);
      if (this.blockSelection.contains(block)) {
         this.blockSelection.remove(block);
         block.deselect(this);
      }
   },

   deselectAllBlocks: function() {
      debugMsg("Deselecting all blocks");
      while (this.blockSelection.size()>0)
         this.deselectBlock(this.blockSelection.get(0));
   },

   deleteSelectedBlocks: function() {
      debugMsg("removing ",this.blockSelection.size()," block(s)");
      for (let i = this.blockSelection.size()-1; i>=0; i--) {
         this.removeBlock(this.blockSelection.get(i));
      }
   },

   checkAddCustomFunction: function(fName) {
      if (!isString(fName)) return false
      fName = fName.substring(1,fName.length-1)
      debugMsg("Checking if",fName,"is a custom function to add to defunList")
      const result = custom_functions.contains(fName)
      if (result) {
         debugMsg(fName,"is a custom function")
         if (!this.defunList.contains(fName)) {
            debugMsg("Adding to defunList")
            this.defunList.add(fName,custom_functions.get(fName));
         } else {
            debugMsg("Already in defunList")
         }
      } else {
         debugMsg(fName,"is not listed as a custom function")
      }
      return result;
   }

}

// block functions - add, select, deselect, remove, blocktype, endblock - are messy

/* block type - div to drag in and use
   position is a css expression of the blockType's position
   inConn is the number of input connections accepted (ie of parameters for function)
   blockHTML is a string giving the HTML to be used to display the block (label by default)
   blockValue - is a function to use when the block is called ($.text() by default)
*/
const BlockType = {

   init: function(label, defGUI) {

      debugMsg("new block type",label,defGUI);

      this.element = undefined;
      this.pos = undefined;
      this.label = label;
      this.blockCode = (defGUI.blockCode)?(defGUI.blockCode):"";
      if (defGUI.tip) this.tip = defGUI.tip;
      this.getExp = defGUI.getExp;
      this.dropCode = defGUI.dropCode;
      this.inConn = (defGUI.args==='undefined')?2:defGUI.args;
      this.outConn = (defGUI.output==='undefined')?1:defGUI.output;
      this.uses = Object.create(Bag).init();
      return this;
   },  

   addTo: function(position,section) {
      const elt = $('<div>').addClass('blockType');
      this.element = elt;
      this.setLabel(this.label);
      if (this.tip) this.element.prop('title',this.tip);

      section.append(elt);
      this.setPos(position);

      // drag block
      elt.draggable({
         cursor: 'move',
         revert: 'invalid',
         opacity: '0.5',
         zIndex: '2700',
         helper: 'clone',
         containment: 'document' //,
         // start: function (event,ui) {
         //        ui.helper.detach().appendTo($('#maincontainer')).offset(ui.offset);
         //      }
      });

   },

   addUse: function(block) {
      debugMsg(this.label, this.uses.size()," uses");
      this.uses.queue(block);
      debugMsg("Now ", this.uses.size()," uses");
   },

   removeUse: function(block) {
      debugMsg("don't forget... Remove block use");
      this.uses.remove(block); // could return it as well?
   },

   setPos: function(position) {
      /*
      // position is either a number - to place type on a column on the left
      // or a css object of the form {top:y; left:x}
      if ($.isNumeric(position))
         debugMsg("not setting");
         // position = {left:-25};
         // position = {top:10*position-10,left:-25};
      */
      if ($.isNumeric(position.top) || $.isNumeric(position.bottom) || $.isNumeric(position.left) || $.isNumeric(position.right)) {
         this.pos = position;
         this.moveBack();
         debugMsg("new pos ",this.pos);
      }
   },

   moveBack: function() {
      if (this.pos) {
         debugMsg("back to ", this.pos);
         this.element.css('top', 'auto').css('left', 'auto').css(this.pos);
      }
   },

   // sets the new label for a given block
   setLabel: function(label) {
      if (label != '') {
         this.element.html(label);
         /************* to blockTypeList x 2 ***********/
         blockTypeList.add(label, this);
         debugMsg("added ",label," to blockTypeList size ",blockTypeList.size());
         return true;
      }

      return false;

   },

   changeLabel: function(newLabel) {
      /************* to blockTypeList x 4 ***********/
      if (newLabel != '' && (!blockTypeList.contains(newLabel))) {
         this.element.html(newLabel);
         blockTypeList.add(newLabel,this);
         blockTypeList.remove(this.label);
         this.label = newLabel;
         debugMsg("changed ",newLabel," in blockTypeList ",blockTypeList.size());
         debugMsg("renaming the uses ", this.uses.size());
         this.uses.map(function(block) {
            block.setHTML();
         })
         return true;
      }

      return false;

   },

   addArgument: function() {
      const n = this.inConn;
      this.uses.map(function(block) {
         block.addArgument(n);
      });
      this.inConn++;
   },

   removeArgument: function(n) {
      debugMsg("remove argument num ", n, " of ",this.inConn);
      let ok = true;
      if (this.inConn >= n) {
         let ct = 0;
         for (let i = this.uses.size()-1; i>=0; i--) {
            if (this.uses.get(i).isInputConnected(n)) ct++;
         }
         debugMsg("removing ", ct, " connectors");
         if (ct>0) {
            ok = confirm('This argument is being used by '+ct+' connectors. Are you sure you want to remove it?');
         }
         if (ok) {
            this.inConn--;
            this.uses.map(function(blockUse) {
               debugMsg("removing input",n,"from block",blockUse.id);
               blockUse.removeInput(n);
            });
         }
		   else debugMsg("not removing argument");
      }
      debugMsg("remove argument returns",ok)
      return ok;

   }
}

// blockInstance
const BlockInstance = {

   init: function(type, pipe, pos, id) {
      debugMsg("new block");
      this.inCount=0;
      this.type = type; // blockType element - contains a lot of data
      this.pipe = undefined; // pipe (when the block is added)
      this.id = undefined;
      this.inPoints = Object.create(Bag).init(); // list of JSPlumb enpoints for inputs
      this.outPoint = undefined; // outPoint is the endPoint object, needed to find connections
      this.element = $('<div>')
                     .addClass('block');
      this.setHTML();
      this.setPosition(pos);
      this.setPipe(pipe,id);
      return this;
   },

   setID: function(id) {
      if (id==null) id = this.pipe.nextID();
      this.element.attr('id',id);
      this.id = id;
   },

   setPipe: function(pipe,id) {
      this.pipe = pipe;
      this.setID(id);
      pipe.canvas.append(this.element);

      this.type.addUse(this);
      this.setOutput();
      this.setInputs();

      pipe.plumber.draggable(this.element, { containment: 'parent', filter: ".ui-resizable-handle" });

      const self = this;

      this.element.resizable({
         containment: "parent",
         resize: function(e, ui) {
            self.repaint();
            self.pipe.save();
        }
      })

      this.element.click(function(e) {
         e.stopPropagation();
         self.pipe.deselectAllBlocks();
         self.select();
         self.pipe.displayExpression(self.id);
      });

      const dropCode = this.dropCode();
      if (dropCode != undefined) {
         debugMsg('running dropcode', dropCode);
         const block = this;
         eval(dropCode);
      }
   },

   // *** using new endPoint object
   setOutput: function() {
      debugMsg("Adding block output");
      const e = Object.create(BlockEndpoint).init().setSource().setPos('right');
      debugMsg(e.getAnchor())
      if (this.outConnections() == -1) {
         e.setMulti();
      }
      this.outPoint = e;
      e.addTo(this); // add endpoint to block
   },

   setInputs: function() {
      // check if input connections are required for this block
      const inConn = parseInt(this.inConnections());
      if (inConn>0) {
         // add input connections
         debugMsg("There are ",inConn," inputs");
         for (let ct=1; ct<=inConn; ct++) {
            this.addInput(ct/(inConn+1));
         }
      }
   },

   // *** using new endPoint object
   addArgument: function() {
      const num = this.inPoints.size();
      debugMsg("adding new argument to block",num);
      this.addInput((num+1)/(num+2));
      for (let n = 0; n<num; n++) {
         debugMsg("shifting up", n, "of", num);
         let iP = this.inPoints.get(n);
         debugMsg("endPoint to shift details",iP.ep.getParameters());
         iP.setPos('left',(n+1)/(num+2)).updateProps();
      }
   },

   // *** using new endPoint object
   addInput: function(num) {
      if (num===undefined) num = 0.5;
      const e = Object.create(BlockEndpoint).init().setPos('left',num).addTo(this);
      debugMsg("added endpoint to block",this.id,e.ep.getParameters());
      this.inPoints.queue(e);
   },

   // *** using new endPoint object
   removeInput: function(num) {
      debugMsg("Removing input num ",num," of block ",this.id);
      let iP = this.inPoints.get(num);
      iP.remove();
      this.inPoints.remove(iP);
      for (const size = this.inPoints.size(); num<size; num++) {
         debugMsg("shifting", num, "of", size);
         iP = this.inPoints.get(num);
         debugMsg("endPoint to shift details",iP.ep.getParameters());
         iP.setPos('left',(num+1)/(size+1)).updateProps();
      }
      debugMsg(this.id, " has ", this.inPoints.size(), " arguments");

   },

   isInputConnected: function(num) {
      return this.inPoints.get(num).isConnected();
   },

   setPosition: function(pos) {
      this.element.css(pos);
   },

   getPosition: function() {
      // function should exist, but not working?
      const t = this.element.css('top');
      const l = this.element.css('left');
      return {'top':t, 'left':l}
   },
   
   getSize: function() {
      // function should exist, but not working?
      const w = this.element.width();
      const h = this.element.height();
      return {'height':h, 'width':w}
   },

   setHTML: function() {
      let inHTML = this.type.label

      if (this.type.hasOwnProperty("blockCode")) {
         inHTML += '<br />'+this.type.blockCode
      }

      this.element.html(inHTML);
   },

   isArg: function() {
      return this.type.label == "Argument";
   },

   getExpression: function() {
      let result;
      if (this.type.getExp) {
         let fn = "(function(block) {"+this.type.getExp+"})(this.element)";
         debugMsg("evaluating: ",fn);
         result = eval(fn);
      }
      else {
         result = this.type.label;
      }
      debugMsg("We got",result)

      // if the result is not a string (number, boolean...), return
      if (!isString(result)) {
            debugMsg(result, "is not a string; returning it")
            return result
      }

      // if it is a constant, return as is, unless it starts with a `

      if (this.type.label == "constant") {
         result = result.replaceAll("`","\\`") // escape the backtick special character
         debugMsg("it's a constant, returning sanitised",result)
         return result;
      }

      // anything else is a function or varname. Place in backticks ``
      // to not confuse them with user data
      debugMsg("it's a string and not data, returning in ``",result)
      result = '`'+result+'`'
      return result;
   },

   copyStateTo: function(targetBlock) {
      // updates the targetBlock according to the state of this block
      // used to make a copy of custom block
      targetBlock.setState(this.getState());
   },

   getState: function() {
      // returns the state of the block input(s) and select(s) if there are any
      // use to serialise the block state
      const state = {}
      const inputs = this.element.find('form > input');
      if (inputs.length>0) {
         state.inputs = [];
         for (let i in inputs) {
            if (inputs[i].value) state.inputs.push(inputs[i].value);
         }
      }
      debugMsg("block inputs state",state);
      const selects = this.element.find('form > select');
      if (selects.length>0) {
         state.selects = [];
         for (i in selects) {
            if (selects[i].value) state.selects.push(selects[i].value);
         }
      }
      debugMsg("Block state:",state);
      return state
   },

   setState: function(state) {
      // updates the block according to state data (see getState)
      // use to recover the block's state from serialised information
      if (state.hasOwnProperty("inputs")) {
         const inputs = this.element.find('form > input');
         for (let i in state.inputs) {
            inputs[i].value = state.inputs[i];
         }
      }
      if (state.hasOwnProperty("selects")) {
         const selects = this.element.find('form > select');
         for (let i in state.selects) {
            selects[i].value = state.selects[i];
         }
      }
   },

   getJSON: function () {
      const result = this.getState(),
            pos = this.getPosition(),
            size = this.getSize();
      result.top = pos.top;
      result.left = pos.left;
      result.height = size.height;
      result.width = size.width;
      result.type = this.type.label;
      result.id = this.id;
      return result;
   },

   // get block dropCode
   dropCode: function() {
      return this.type.dropCode;
   },

   // get number of accepted input connections for the block
   inConnections: function() {
      return parseInt(this.type.inConn);
   },

   outConnections: function() {
      return parseInt(this.type.outConn);
   },

   // selecting is initiated by the block
   select: function () {
      this.pipe.setFocus();
      this.pipe.selectBlock(this);
      this.element.addClass("blockSelected");
   },

   // deselecting is initiated by the pipe that 'owns' the block
   deselect: function () {
      this.element.removeClass("blockSelected");
   },

   remove: function () {
      this.element.remove();
      this.type.removeUse(this);
   },

   repaint: function() {
      this.pipe.plumber.revalidate(this.element);
   },

   nextCount: function () {
      this.inCount++;
      return this.inCount;
   }
}

const BlockEndpoint = {

   init: function() {
      // endPoint object
      // in progress
      this.block = {};
      this.properties = {};
      this.ep = {};
      this.anchors = [];

      //default settings
      this.setTarget(); // default into, not from, this end point

      return this;
   },

   setTarget: function() {
      this.properties.isTarget = true;
      this.properties.isSource = false;
      this.setExclusive(); // target of only one source
      return this;
   },

   setSource: function() {
      this.properties.isTarget = false;
      this.properties.isSource = true;
      return this;
   },

   isTarget: function() {
      return this.properties.isTarget;
   },

   isSource: function() {
      return this.properties.isSource;
   },

   setExclusive: function() {
      return this.setMultiConnections(false);
   },

   setMulti: function() {
      return this.setMultiConnections(true);
   },

   setMultiConnections: function(multi) {
      if (multi && this.isSource()) {
         // sanity check - only allowed if the endPoint is a source
         debugMsg("using -1 connection limit");
         this.properties.maxConnections = -1;
      }
      else
         this.properties.maxConnections = 1
      return this;
   },

   isMultiConnections: function() {
      if (this.properties.maxConnections == -1) return true

      return false;
   },

   setPos: function(side,n) {
      const p = (n==null)?0.5:n;
      debugMsg("endPoint pos",side,p);
      let a = [];
      switch (side) {
         case 'left': a = [0,p,-1,0]; break;
         case 'top': a = [p, 0, 0, -1]; break;
         case 'right': a = [1,p,1,0]; break;
         case 'bottom': a = [p,1,0,1];
      }

      return this.setAnchor(a);
   },

   on: function(evt,fn) {
      debugMsg("added outpoint",evt);
      return $(this.ep.canvas).on(evt,fn);
   },

   trigger: function(evt) {
      //debugMsg("triggering",evt);
      return $(this.ep.canvas).trigger(evt);
   },

   toolTip: function(t) {
      const elt = $(this.ep.canvas);
      if (t) {
         elt.prop("title",t);
	  }
	  else {
         return elt.prop("title");
      }
   },

   setAnchor: function(p) {
      this.properties.anchors = p;
      debugMsg('anchors',p);
      return this;
   },

   getAnchor: function() {
      return this.properties.anchors;
   },

   setUuid: function() {
      let uuid  = this.block.id+'_';
      uuid += (this.isSource())?'out':('in'+this.block.nextCount());
      this.properties.uuid = uuid;
      return this;
   },

   getUuid: function() {
      return this.properties.uuid;
   },

   isConnected: function() {
      //isConnected returns true if the endPoint is a connected-target-
      //it doesn't apply to source
      if (this.isTarget()) return this.ep.isFull();

      return null;
   },

   findConnectedSource: messagerise(function(connList) {
      // to find if a block is connected to this endPoint
      debugMsg("Checking connection");

      // if not connected - exit now
      if (!this.isConnected()) return null;

      // it is connected
      debugMsg("there is one, seeking among", connList.length);
      const id = this.getUuid();
      // go through the blocks in the connList.

      for (let i=0; i<connList.length; i++) {
         // for each block, check if the connList contains the matching source.
         const ep = connList[i].endpoints;
         debugMsg("trying source",i, ep[0].getUuid(), ep[1].getUuid());
         if (id===ep[1].getUuid()) {
            return $(ep[0].getElement()).attr("id");
         }
         // not an efficient process
         // a better setup for this might be to maintain this data
         // when the user creates/removes the connections
      }

   },"found block:"),

   addTo: function(b) {
      debugMsg("adding endpoint with props", this.properties);
      this.block = b;
      this.setUuid();
      const e = b.pipe.plumber.addEndpoint(b.element, this.properties, config.connectStyle);
      debugMsg("Endpoint added ",e.anchor);
      this.ep = e;
      return this;
   },

   updateProps: function() {
      debugMsg("props changed to",this.ep.anchor, this.properties);
      //setParameters not working as documented
      //this.ep.setParameters(this.properties);
      this.ep.anchor.x = this.getAnchor()[0];
      this.block.repaint();
   },

   remove: function() {
      this.ep.detachAll();
      this.block.pipe.plumber.deleteEndpoint(this.ep);
   }

}

function editBlock() {

   if (currentBE) {
	  debugMsg('change edited block');
	  currentBE.editor.dialog('close');
   }

   currentBE = Object.create(BlockEditor).init();
   $('#createNewBlock').attr('disabled','disabled');

   currentBE.setFocus();
}

const BlockEditor = {

   init: function(size = {}) {
      debugMsg("making block editor");

      // Create dialog for editor
      const inpt = $('');
      const form = '<form onSubmit="return false;">Block: <input type="text" size=7 /><br /><button onClick="currentBE.addArgument();">Add Argument</button></form>';
      const blockID = 'block-dialog';
      this.editor = $('<div>').attr('id',blockID);
      this.editor.append(form);
      this.width = 560;
      this.height = 420;
      if (size.width) this.width = size.width;
      if (size.height) this.height = size.height;

      // To move the form into the title bar, html in title, see 
      // https://stackoverflow.com/questions/20741524/jquery-dialog-title-dynamically

      this.editor.dialog({width: this.width, height: this.height, title: 'Edit Block'});

      // create and establish the draggable 'user block'
      const uB = Object.create(CustomBlock).init(this);
      newBlocks.queue(uB);
      this.setUserBlock(uB);

      // the blockID ('block-dialog') is itself in the list of pipe blocks
      // because the return endPoint is (virtually) a block
      uB.pipe.blockList.add(blockID, this.userBlock.pipe);

      uB.pipe.plumber.addEndpoint(this.editor, {
         anchors:[1,0.5,-1,0],
         uuid: "end_in0",
         isTarget: true,
         maxConnections: 1
      }, config.connectStyle);

      return this;
   },

   setUserBlock: function(userBlock) {
      this.userBlock = userBlock;

      this.editor.find("input")
         .off('input')
         .on('input', function() {userBlock.rename(this.value);} )
         .val(userBlock.name);

      this.editor.on('dialogclose', function() {
         userBlock.done();
		   mainPipe.setFocus();
      });

      const self = this;
      this.editor.bind('dialogresize', function() {
         debugMsg("resizing")
         userBlock.repaint();
         self.width = self.editor.outerWidth();
         self.height = self.editor.outerHeight()+50;
      });

      this.editor.droppable({
         tolerance: 'pointer',
         over: function() {
            mainPipe.canvas.droppable('disable');
         },
         out: function() {
            mainPipe.canvas.droppable('enable');
         },
         drop: function(event,ui) {
            self.drop(ui.draggable,ui.offset);
         }
      });
   },

   drop: function(dropped, offset) {
      this.userBlock.pipe.setFocus();
      if (dropped.hasClass('blockType')) {
         const edPos = this.editor.offset();
         const t = offset.top-edPos.top;
         const l = offset.left-edPos.left;
         const b = focusPipe.addBlock(dropped,{top:t, left:l}); // b is the block
         focusPipe.deselectAllBlocks();
         focusPipe.selectBlock(b);
         mainPipe.canvas.droppable('enable');
      }
   },

   // addArgument function fakes dropping an argument element
   // called by "Add argument" button
   addArgument: function() {
      this.userBlock.addArgument();
   },

   setFocus: function() {
	   this.userBlock.pipe.setFocus();
   },
   
   hasFocus: function() {
	   this.userBlock.pipe.hasFocus();
   }
}

const CustomBlock = {

   init: function(editDialog) {
      // this is block-specific
      debugMsg("making block");
      this.name = this.edGen.next();
      this.num = this.edGen.num();
      this.argGen = Object.create(TokenGenerator).init('arg');
                                          // makes argNames (arg1, arg2...)
      this.argList = Object.create(Bag).init(); // list of arguments
      this.customType = this.newType(); // blockType
      this.icons();
      this.pipe = Object.create(PipeInstance).init(editDialog.editor,this);
      this.bE = editDialog;
      this.edit = undefined;
      this.pipe.save();
      return this;
   },

   // Static field - current block names (newBlock1, ...)
   edGen: Object.create(TokenGenerator).init('newBlock'),

   getSize: function() {
      return {width:this.bE.width, height:this.bE.height};
   },

   newType: function() {
      let cT = Object.create(BlockType).init(this.name,{args:this.argList.size()});
      debugMsg("adding type");
      cT.addTo({left:"10px"},$("#Custom"));
      return cT;
   },

   rename: function(newName) {
      debugMsg("renaming ",this.name," to ",newName);
      if (this.customType.changeLabel(newName)) {
         stateStore.renameBlock(this.name,newName);
         this.name = newName;
         this.icons();
      }
   },

   addArgument: function() {
      const arg = this.pipe.addBlockByName('Argument',{top:0,left:-112});
      this.moveArgument(arg,this.argList.size()-1)
   },

   moveArgument: function(arg,n) {
      if (n<0 || n>= this.argList.size()) return false;
      n++;
      const t = n*50;
      arg.setPosition({top:t, left:-112});
      this.renameArgument(arg,n);
      this.repaint();
   },

   newArgument: function(block) {
      this.argList.queue(block);
      const argNum = this.argList.size()+1;
      this.customType.addArgument();

      const del = $('<img>')
        .attr('src','icons/delete.jpg')
        .attr('width',24)
        .attr('height',24)
        .attr('alt','delete')
        .css({left:-24, position:'relative'});

      const up = $('<img>')
        .attr('src','icons/up.png')
        .attr('width',24)
        .attr('height',24)
        .attr('alt','delete')
        .css({top:-52, position:'relative'});

      const down = $('<img>')
        .attr('src','icons/down.png')
        .attr('width',24)
        .attr('height',24)
        .attr('alt','delete')
        .css({top:-32, position:'relative'});

      let delay;

      block.outPoint.on('mouseover', function(evt) {
         clearTimeout(delay);
         $(evt.currentTarget).append(del);
         $(evt.currentTarget).append(up);
         $(evt.currentTarget).append(down);
         //debugMsg("mouse on argument outpoint", evt.currentTarget);
      });
      block.outPoint.on('mouseout', function() {
         delay = setTimeout(()=>{del.detach(); up.detach(); down.detach()},1000);
      });

      const self = this;
      del.on('click', function(evt) {
         evt.stopPropagation();
         debugMsg("del clicked");
         self.deleteArgument(block);
      });
      
      up.on('click', function(evt) {
         evt.stopPropagation();
         debugMsg("up clicked");
         self.upArgument(block);
      });

      down.on('click', function(evt) {
         evt.stopPropagation();
         debugMsg("up clicked");
         self.downArgument(block);
      });

      debugMsg("new argument ",block.id,argNum);
   },

   argumentInput(block) {
      if (!this.isArgument(block)) return undefined;
      return block.element.find('form > input')[0];
   },

   renameArgument: function(block, i) {
      if (!this.isArgument(block)) return undefined;
      const name = "arg"+i;
      this.argumentInput(block).value = name;
      block.outPoint.toolTip(name);
      return true;
   },

   deleteArgument: function(arg) {
      arg.outPoint.trigger("mouseout");
      if (!this.isArgument(arg)) return undefined;
      //debugMsg("removing 1 arg from",this.argList);
      let i = this.argList.find(arg);
      if (!this.customType.removeArgument(i)) return false;
      this.argList.remove(arg);
      this.pipe.removeBlock(arg);
      let nextArg = this.argList.get(i);
      while (nextArg) {
         debugMsg("renaming arg",i)
         this.moveArgument(nextArg,i);
         i++;
         nextArg = this.argList.get(i);
      }
   },

   downArgument: function(arg) {
      let i = this.argList.find(arg);
      if (i==-1) return false; // not an argument
      arg.outPoint.trigger("mouseout");
      debugMsg("swapping args",i,"with next");
      if (i+1>=this.argList.size()) return false; // last argument - no swap
      const nextArg = this.argList.get(i+1);
      this.argList.set(i,nextArg);
      this.moveArgument(nextArg,i);
      this.argList.set(i+1,arg);
      this.moveArgument(arg,i+1);
   },

   upArgument: function(arg) {
      let i = this.argList.find(arg);
      if (i==-1) return false; // not an argument
      arg.outPoint.trigger("mouseout");
      debugMsg("swapping args",i,"with previous");
      if (i==0) return false; // first argument - no swap
      const prevArg = this.argList.get(i-1);
      this.argList.set(i,prevArg);
      this.moveArgument(prevArg,i);
      this.argList.set(i-1,arg);
      this.moveArgument(arg,i-1);
   },

   isArgument: function(block) {
      const result = this.argList.contains(block);
      debugMsg("Block ", block.id, " in argList?",result);
      return result;
   },

   done: function() {
      debugMsg("new defun's done!")
      this.saveDefun();
      $('#createNewBlock').removeAttr('disabled','disabled');
   },

   delete: function() {
      // need to 'unsave...'
      $('#createNewBlock').removeAttr('disabled','disabled');
      this.customType.element.remove();
      stateStore.removeBlock(this.name);
      newBlocks.remove(this);
   },

   saveDefun: function() {
      const def = this.defun();
      debugMsg("saving the new defun")
      if (def != undefined) {
         debugMsg("done, saved",this.name)
         debugMsg("new function: ",this.name, def);
         custom_functions.set(this.name, def);
      } else {
         debugMsg("no defun to save")
      }
   },

   defun: messagerise(function() {
      this.pipe.useDefaultArguments = false;
      let exp = this.pipe.getFullExpression('block-dialog',this.name);
                       // block-dialog is the div where the endPoint is
      this.pipe.useDefaultArguments = true;
      
      if (exp === undefined) return undefined;
      const defName = this.name;
      paramProcess = function (a) {const p = a.getExpression(); return p.substring(1,p.length-1)}
      return ["`lambda`", this.argList.map(paramProcess), exp];
   }),

   icons: function() {

      //let height = 60+55*(this.num-1);
      const edit = $('<div>');
      const editIcon = $('<img>')
               .attr('src','icons/edit.jpg')
               .attr('width',24)
               .attr('height',24)
               .attr('alt','edit')
               .css({left:24, position:'relative'})
      edit.append(editIcon);
      this.customType.element.append(edit);
      const copy = $('<img>')
            .attr('src','icons/copy.jpg')
            .attr('width',24)
            .attr('height',24)
            .attr('alt','copy')
            .css({left:-24, position:'relative'})
      const del = $('<img>')
            .attr('src','icons/delete.jpg')
            .attr('width',24)
            .attr('height',24)
            .attr('alt','delete')
            //.css({left:48, position:'relative'});
      let delay;

      const self = this;
      del.on('click', function(e) {
         e.stopPropagation();
         edit.remove();
         //debugMsg(self);
         self.bE.userBlock.delete();
         self.bE.editor.dialog('close');
         self.pipe = undefined;
         //self.remove(); // more needed!!
      });

      edit.on('mouseover', function() {
         clearTimeout(delay);
         edit.append(copy);
         edit.append(del);
      });
      edit.on('mouseout', function() {
         delay = setTimeout(mo,1000);
      });
      edit.on('click', function(e) {
         e.stopPropagation();
         debugMsg('edit block');
         if (currentBE != self.bE) {
            debugMsg('change edited block');
            if (currentBE) currentBE.editor.dialog('close');
            currentBE = self.bE;
         }
         if (currentBE.editor.is(":hidden")) {
            debugMsg('show editor');
            currentBE.editor.dialog('open');
            self.repaint();
         }
		 currentBE.setFocus();
      });

      copy.on('click', function(e) {
         e.stopPropagation();
         // make a copy
         debugMsg('copy block');
         // let oldBlock = self;
         currentBE.editor.dialog('close');
         editBlock();
         const newName = self.name+'_copy'
         currentBE.userBlock.rename(newName);
         currentBE.editor.find("input").val(currentBE.userBlock.name);
         for (let bID in self.pipe.blockList.list) {
            if (bID!='end') {
               const oB = self.pipe.blockList.get(bID);
               debugMsg('old block', bID);
               const oType = oB.type.element;
               const oPos = oB.getPosition();
               debugMsg(oPos);
               const newB = currentBE.userBlock.pipe.addBlock(oType,oPos);
               oB.copyStateTo(newB);
            }
         }
         const connections = self.pipe.plumber.getConnections();
         connections.map(
            conn => {
               debugMsg("Connecting", conn.sourceId, "to", conn.targetId);
               const epout = conn.endpoints[0].getUuid(),
                     epin = conn.endpoints[1].getUuid(); 
               debugMsg("Connecting", epout, "to", epin);
               currentBE.userBlock.pipe.plumber.connect({uuids:[epout,epin]});
            }
         );
         stateStore.copyBlock(self.name,newName);
      });

      let mo = function() {
         copy.detach();
         del.detach();
      }

   },

   repaint: function() {
      this.pipe.plumber.repaintEverything();
   }

   /* not called correctly from delete click event
   , // comma separating the methods
   customBlock.prototype.remove: function() {
      this.edit.remove();
   }
   */
}

const stateSaver = {
// Stores and recover the state of the system (GUI+pipe+custom blocks)
// in browser local storage

   init: function (pre) {
      // this.blockList = Object.create(Bag).init(); // list of blocks names (not needed?)
      this.prefix = pre;
      this.loadStateGUI(); // state of interface: what block is open, whether details are up, what accordion is showing
      this.mainPipe = {}; // the main pipe, in the same format as block definitions
      this.blocks = Object.create(Collection).init(); // one entry per custom block
      this.saving = true;

      return this;
   },

   load: function() {
      this.saving = false;
      this.loadBlocks();
      this.loadMainPipe();
      this.saving = true;
      this.loadStateGUI();
      debugMsg("all loading done");
   },

   loadFile: function(data) {
      // saves then loads the data
      debugMsg("loading pipe");
      const mp = data.mainPipe;
      delete data.mainPipe;
      for (blockName in data) {
         this.addBlock(blockName,data[blockName]);
      }
      this.updateMainPipe(mp);
      this.load();
   },

   saveBlock: function(blockName) {
      if (this.saving) {
         this.setItem(blockName,this.blocks.get(blockName));
      }
   },

   renameBlock: function(oldName,newName) {
      this.blocks.rename(oldName,newName);
      this.saveBlock(newName);
      this.removeBlock(oldName);
      return this;
   },

   copyBlock: function(oldName,newName) {
      this.blocks.copy(oldName,newName);
      this.saveBlock(newName);
      return this;
   },

   saveMainPipe: function() {
      if (this.saving) {
         this.setItem("mainPipe",this.mainPipe);
      }
   },

   saveStateGUI: function() {
      if (this.saving) {
         this.setItem("stateGUI",this.stateGUI);
      }
   },

   allBlocks: function() {
      return this.allKeys(k=>(k != 'mainPipe' && k != 'stateGUI'));
   },

   loadBlocks: function() {
      this.allBlocks().map(b=>this.loadBlock(b)).map(f=>f());
   },

   loadBlock: function(blockName) {
      /* loads the block in two stages:
          - creates the block and sets arguments as it runs
          - returns a function to complete the block rebuilding. */
      debugMsg("loading",blockName);
      const blockString = this.getItem(blockName);
      this.blocks.set(blockName,blockString);
      currentBE = Object.create(BlockEditor).init(blockString.size);
      currentBE.userBlock.rename(blockName);
      currentBE.editor.find("input").val(blockName);
      currentBE.userBlock.repaint();
      const p = currentBE.userBlock.pipe;
      p.setArgsFromJSON(blockString);
      currentBE.editor.dialog('close');
      return function() {p.setExpFromJSON(blockString);};
   },

   loadMainPipe: function() {
      const mp = this.getItem("mainPipe");
      if (mp) {
         this.mainPipe = mp;
         mainPipe.setExpFromJSON(mp);
         // to do: update the pipe with the blocks
      }
   },

   loadStateGUI: function() {
      // Get from storage, then filter data
      const sg = this.getItem("stateGUI");
      this.stateGUI = {};
      if (sg) {
         // is the detail panel showing?
         const detailsOn = (sg.details)?true:false; // boolean
         if (detailsOn) {
            $( "#codeDetails" ).show();
            $( "#toggleDetails" ).attr("value","Hide details");
         }
         else {
            $( "#codeDetails" ).hide();
            $( "#toggleDetails" ).attr("value","Show details");
         }
         this.stateGUI.details = detailsOn;
         // which accordion group to show?
         let acc = Number.parseInt(sg.accordion);
         // debugMsg("accordion says ",sg.accordion," which is ",acc);
         if (acc==NaN) acc = 0; //default
         $( "#accordion" ).accordion( "option", "active", acc );
         this.stateGUI.accordion = acc;
         // this.stateGUI.pipe = (sg.pipe)?
         // this.stateGUI = this.getItem("stateGUI");
      }
   },

   addBlock: function(blockName,blockValue) {
      this.blocks.add(blockName,blockValue);
      this.saveBlock(blockName);
   },

   updateBlock: function(customBlock,pipeData) {
      this.blocks.set(customBlock,pipeData);
      this.saveBlock(customBlock);
   },

   removeEverything: function() {
      this.removeAllBlocks();
      this.removeMainPipe();
   },

   removeAllBlocks: function() {
      this.allBlocks().forEach((b)=>(this.removeBlock(b)));
   },

   removeBlock: function(customBlock) {
      this.blocks.remove(customBlock);
      this.removeItem(customBlock);
   },

   removeMainPipe: function () {
      this.removeItem("mainPipe",this.mainPipe);
   },

   updateMainPipe: function (pipeData) {
      this.mainPipe = pipeData;
      this.saveMainPipe();
   },

   updateCurrentPipe: function (pipeData,pipeOwner) {
      // Find current editor and save this pipe
      if (pipeOwner)
         this.updateBlock(pipeOwner.name,pipeData);
      else
         this.updateMainPipe(pipeData);
   },

   updateFocus: function (pipeName) {
      // store new pipe if there is one - remove old one if not
      if (pipeName)
         this.stateGUI.pipe = pipeName;
      else
         delete this.stateGUI.pipe;
      this.saveStateGUI();
   },

   updateShowDetails: function (details) {
      // details is true or false, depending whether the panel shows
      this.stateGUI.details = details;
      this.saveStateGUI();
   },

   updateAccordion: function (panelNum) {
      // accordion is the name of the accordion panel currently showing
      this.stateGUI.accordion = panelNum;
      this.saveStateGUI();
   },

   setItem: function(key,val) {
      localStorage.setItem(this.prefix+key,JSON.stringify(val));
      debugMsg("store set", key, val);
      return val;
   },

   getItem: function (key) {
      const val = JSON.parse(localStorage.getItem(this.prefix+key));
      debugMsg("store get", key, val);
      return val;
   },
   
   getAllItems: function() {
      const result = {};
      for (k of this.allKeys()) {
       result[k] = this.getItem(k);
      }
      return result;
   },

   key: function(i) {
      // key receives an item number
      // and returns the key value if the key starts with the correct prefix
      // if the key does not start with the correct prefix it returns null
      const k = localStorage.key(i);
      if (!k.startsWith(this.prefix)) return null
      const l = this.prefix.length;
      debugMsg("Local storage",i,k);
      return k.substring(l);
   },

   allKeys: function(filter = (k) => (true)) {
      // returns the set of blocks as a JSON string
      // filter: f(key)->bool, optional filter.
      const len = localStorage.length, result = [];
      for (let i=0 ; i < len ; i++) {
         let k = this.key( i );
         if (k != null && filter(k)) { // all non-null keys that pass the filter
            result.push(k);
         }
      }
      debugMsg("storage keys:",result);
      return result;
   },

   removeItem: function(key) {
      localStorage.removeItem(this.prefix+key);
      debugMsg("store delete", key);
   }
}

const config = {
   // config information
   connectStyle:{
      endpoint:"Dot",
      paintStyle:{ fillStyle:"lightgrey" },
      hoverPaintStyle:{ fillStyle:"lightgreen" },
      connector: ["Bezier", { curviness: 50}],
      connectorStyle:{ strokeStyle:"lightgrey", lineWidth:8 },
      connectorHoverStyle:{ strokeStyle:"lightgreen", lineWidth:10 },
      ConnectorOverlays:[ ["Arrow" , { width:12, length:12, location:0.67 }] ]
   }
}


/* Set of predefined functions
   predefined functions both define the blocks available to interconnect
   in a graphical interface and the code to use to compile the workflow
*/

// GUI - for the draggable blocks
let predefined_gui;

// main space for plumbing
let mainPipe;

// list of Block Types to drag
let blockTypeList;

// blockEditor object
let currentBE;

// which pipe (main or blockeditor) has the focus
let focusPipe; // set to mainPipe at initialisation

// set of custom (user-defined) functions
const custom_functions = Object.create(Collection).init();

// Maintain state in local storage
const stateStore = Object.create(stateSaver).init("openpiping");

const newBlocks = Object.create(Bag).init();

const qString = Object.create(queryString).init();

/* start:
   - load the file of predefined functions
   - launch initialisation
*/

function initialise() {
   // initialise the GUI list of block types

   const pipeCanvas = $('#pipeContainer');

   mainPipe = Object.create(PipeInstance).init(pipeCanvas);
   mainPipe.setFocus(); // main is in focus by default

   blockTypeList = Object.create(BlockTypeList).init(); // all block types to drag (small b!)
   blockTypeList.initBlocks();

   // add the 'end' block
   // the endBlock identifies the result of the function
   mainPipe.addEndBlock();

   pipeCanvas.droppable({
      tolerance: 'pointer',
      over: function() {
         debugMsg("ready to drop");
      },
      out: function() {
         debugMsg("off the drop");
      },
      drop: function(event,ui) {
         const blockType = ui.draggable;
         mainPipe.setFocus();
         if (blockType.hasClass('blockType')) { //boolean was: hasClass('blockType') && blockType.html()!='Argument'
            const b = mainPipe.addBlock(blockType,ui.position); // b is the block
            mainPipe.deselectAllBlocks();
            mainPipe.selectBlock(b);
         }
      }
   });

   // del = delete selected block(s); backspace = suppress navigation
   $('html').keydown(function(e){
      // guard forms inputs
      const $target = $(e.target||e.srcElement);
      //debugMsg("key down",e.keyCode,$target)
      if ($target.is('input,[contenteditable="true"],textarea')) return;

      // delele block
      if (e.keyCode == 46) { // && e.target==document.body) {
         // if delete key and in body (not form), delete the block
         debugMsg("deleting");
         focusPipe.deleteSelectedBlocks();
         return;
      }

      // if backspace: only allow in an editable element
      if (e.keyCode == 8) {
         const $target = $(e.target||e.srcElement);
         if (!$target.is('input,[contenteditable="true"],textarea')) {
            e.preventDefault();
         }
      }
   });

   // last section, custom blocks

   const custom = blockTypeList.addSection("Custom");
   custom.append('<button id="createNewBlock" onClick="editBlock();">New block</button>');

   // add argType block type to custom functions
   const argType = {
      label: "Custom",
      args: 0,
      blockCode : "<form><input type='text' size='2' disabled='disabled' /><form>",
      dropCode: "currentBE.userBlock.newArgument(block);",
      getExp: "let inpt = block.find('form > input')[0]; return inpt.value;",
      output: -1 // number of output connections is illimited
   }

   // make argument blockType but add to accordion *hidden*
   // the invisible type is used by "add argument" button in block editor
   let a = Object.create(BlockType).init('Argument',argType);
   a.addTo({top:0, height:1, visibility:"hidden"}, custom);

   $( "#accordion" ).accordion( {
      activate: function( event, ui ) {
         const active = $( "#accordion" ).accordion( "option", "active" );
         stateStore.updateAccordion(active);
      }
   } ) // {heightStyle: "fill");

   // query sting option: remove previous work
   if (qString.get("wipe")==="true") {
      stateStore.removeEverything();
   }
   
   if (qString.get("load")) {
      const fName = 'saved/'+qString.get("load")+'.json';
      fetch(fName).then(function(response) {
         if(response.ok) {
            response.text().then(function(text) {
               stateStore.loadFile(JSON.parse(text))
            });
         } else {
            debugMsg('Not found the file to load');
         }
      });
   } else {
      stateStore.load();
   }

}

jsPlumb.ready(function() {
   // load block GUI
   debugMsg("begin initialisation");
   $( document ).tooltip();
   $.ajax({
      url: "gui.json",
      beforeSend: function(xhr){
         if (xhr.overrideMimeType) {
            xhr.overrideMimeType("application/json");
         }
      },
      success: function(json) {
         debugMsg("found gui",json);
         predefined_gui = json;
         initialise();
      },
      error: function(_, status, err) {debugMsg(status+'\n'+err);}
   });
   
   $.widget("ui.dialog", $.extend({}, $.ui.dialog.prototype, {
    _title: function(title) {
        if (!this.options.title ) {
            title.html("&#160;");
        } else {
            title.html(this.options.title);
        }
    }
   }));
});


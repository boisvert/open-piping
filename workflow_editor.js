
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
         //numBlock++;
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
         //
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
      this.canvas = element; // the document element to attach blocks etc. top
      this.plumber = jsPlumb.getInstance(this.canvas); // jsPlumb instance - see jsPlumb API
      this.idNum = 0; // for generating the ID of blocks in use in this pipe
      this.tokenList = Object.create(Collection).init(); // for generating the list of tokens
      this.defunList = Object.create(Collection).init(); // for generating the list of defuns
      this.blockSelection = Object.create(Bag).init(); // list of blocks selected for interaction
      this.blockList = Object.create(Collection).init(); // all block objects on this pipe
      this.useDefaultArguments = true; // used to swap arguments when debugging custom blocks
      this.owner = owner; // owner is the editor for custom blocks, null otherwise

      const that = this;
      this.plumber.bind("connection", function(info) {
         debugMsg('connecting ', info.sourceEndpoint.getUuid(),'to ', info.targetEndpoint.getUuid());
         that.save();
      });
      this.plumber.bind("connectionDetached", function(info) {
         debugMsg('detaching ', info.sourceEndpoint.getUuid(),'from ', info.targetEndpoint.getUuid());
         that.save();
      });
      this.canvas.click(function(e) {
        // If the click was not inside the active span
        debugMsg("click");
        if(!$(e.target).hasClass('blockSelected')) {
          //e.stopPropagation();
          debugMsg("canvas clicked");
          that.deselectAllBlocks();
          that.getFocus();
          stateStore.updateFocus();
        }
      });

     return this;
   },

   getFocus: function() {
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

      debugMsg("adding block to pipe") // formerly had ,this);
      const b = Object.create(BlockInstance).init(realType, this, pos, id);

      this.blockList.add(b.id, b);

      this.save();

      return b;
   },

   removeBlock: function(block) {
      let ok = true;
      if (!mainPipe.hasFocus()) {
         if (currentBE.userBlock.isArgument(block)) {
            debugMsg("the block is an argument");
            ok = currentBE.userBlock.deleteArgument(block);
         }
      }
      if (ok) {
         this.plumber.detachAllConnections(block.element);
         this.plumber.removeAllEndpoints(block.element);
         // ***should also clean up the endpoint objects?
         this.plumber.detach(block.element);
         this.deselectBlock(block);
         this.blockList.remove(block.id);
         block.remove();
         this.save();

      }
   },

   /* adding the 'endBlock'. Unlike others,
      it has no output endpoint; it also can't be removed from the canvas.
      this would be best organised with inheritance. Not done yet.
   */
   addEndBlock: function (inCustomBlock) {
      // inCustomBlock - not in use
      const blockID = 'end';
      const block = $('<div>').attr('id',blockID);
      this.blockList.add(blockID, this);
      this.type = {id: 'end'};

      this.canvas.append(block);
      /*
      if (inCustomBlock) {
         block.css({bottom:20, right:1, position:"absolute", height:"1px", width:"1px"});
         this.plumber.addEndpoint(block, {
            anchors:[1,0.5,-1,0],
            uuid: "end_in0",
            isTarget: true,
            cssClass:"block-end",
            maxConnections: 1
         }, config.connectStyle);
      } else
      { */
         block.addClass('block').text('End');
         block.css({bottom:10, right:10});
         this.plumber.addEndpoint(block, {
            anchors:[0,0.5,-1,0],
            uuid: "end_in0",
            isTarget: true,
            maxConnections: 1
         }, config.connectStyle);
      // } // end of "inCustomBlock" conditional

      // *** this should be making an endPoint target object to add

      //this.plumber.repaintEverything();

      const that = this;
      $(block).click(function(e) {
         e.stopPropagation();
         that.blockSelection.clear();
         that.displayExpression(blockID);
      });
   },

   // output function to view the expression for a block
   displayExpression: function (blockID) {
      changeSExp(this.getFullExpression(blockID));
      this.save();
   },

   getFullExpression: function (blockID) {
      this.tokenList.clear();
      this.defunList.clear();
      // debugMsg(this.blockList);
      let exp = this.getExpression(blockID);
      debugMsg("Exp before defuns",exp);
      // let elements = Object.create(Bag).init();
      if (this.defunList.empty()) {
         debugMsg("No defuns");
      } else {
         debugMsg("Some defuns",this.defunList);
         for (let id in this.defunList.list) {
            exp = this.defunList.get(id).concat([exp]);
         }
         debugMsg(exp);
      }
      debugMsg(exp);
      return exp;
   },

   getExpression: function (blockID) {
      debugMsg("seeking expression for ",blockID);
      const block = this.blockList.get(blockID);
      //debugMsg("block is",block);

      // Connections is the list of connections that target this block
      // jsPlumb doesn't offer a method for filtering this by endPoint.
      const connections = this.plumber.getConnections({ target:blockID });
      debugMsg(connections.length, "connections found");

      //op contains the result
      let op;

      // the bizarre 'end' block breaks everything
      // end block is a different case because
      // inPoints are not properly set up. Needs repair
      if (blockID==='end' || blockID==='block-dialog' ) {
         debugMsg("end block");
         if (connections.length==1)
            op = this.getExpression(connections[0].sourceId)
         else
            op = null;
      }
      else if (this.useDefaultArguments&&block.type.label==='Argument') {
         debugMsg("Substituting argument name for default value");
         op = 0;
      }
      else if (block.type.label=='use block') {
         debugMsg("use block");
         // find if theres a connection for t input, use if yes, null if not
         debugMsg("checking input");
         const source = block.inPoints.get(0).findConnectedSource(connections);
         let e = source?this.blockList.get(source).getExpression():null;
         debugMsg("found the name of the block: ",e);
         if (custom_functions.contains(e)) {
            if (!this.defunList.contains(e)) {
               this.defunList.add(e,custom_functions.get(e));
            }
         }
         op = ["block", e];
      }
      else {
         // inputs is the list of Input endPoints for the block
         const inputs = block.inPoints;

         // exp is the expression contained in the current block.
         let exp = block.getExpression();

         if (custom_functions.contains(exp)) {
            if (!this.defunList.contains(exp)) {
               this.defunList.add(exp,custom_functions.get(exp));
            }
            if (inputs.size()==0) exp = [exp];
         }

         if (inputs.size()>0) {
            if (exp == "assign") {
               if (!this.tokenList.contains(blockID)) {
                  // set the token value according to the expression connected source
                  // or to null if there is none
                  const v = (connections.length>0)?this.getExpression(connections[0].sourceId):null;
                  this.tokenList.add(blockID,v);
                  op = ["assign", blockID, v]
               } else {
                  op = blockID;
               }
            }
            else {
               op = [exp];
               for (let i = 0; i<inputs.size(); i++) {
                  // iterate through inputs
                  // find if theres a connection for each input, use if yes, null if not
                  debugMsg("checking input",i);
                  const source = inputs.get(i).findConnectedSource(connections);
                  const e = source?this.getExpression(source):null;
                  op.push(e);
               }
            }
         }

         else op = exp;
      }
      debugMsg("Got expression", op);
      return op;
   },

   save: function() {
      stateStore.updateCurrentPipe(this.getJSON(),this.owner);
   },

   getJSON: function() {
      /* serialise the pipe into a JSON structure for saving
         Structure: {blocks: Array, args: int, connections: Array}
         - array of blocks, each contains block description, in an array: [label, position, state]
         (state is data of block form, see blockInstance.getJSON)
         - array of connections contains pairs [source,target]
         (source and target being the UUID of the endpoint connected
      */
      let blocks = [];
      let args = 0;
      for (let bID in this.blockList.list) {
         if (bID!='end' && bID!='block-dialog' ) {
            const b = this.blockList.get(bID);
            if (b.isArg()) {
               blocks.unshift(b.getJSON());
               args++;
            }
            else {
               blocks.push(b.getJSON());
            }
         }
      }
      const connections = {}
      this.plumber.getConnections().map(
         conn => {
            const epout = conn.endpoints[0].getUuid(),
                  epin = conn.endpoints[1].getUuid();
            debugMsg("Connecting", epout, "to", epin);
            connections[epin]=epout;
         }
      );
      const result = {blocks:blocks, args:args, connections:connections};
      // debugMsg(result);
      return result;
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

      debugMsg("new block ",label,defGUI);

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
      else {
         return false;
      }
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
      else {
         return false;
      }
   },

   addArgument: function() {
      this.uses.map(function(block) {
         block.addInput();
      });
      this.inConn++;
   },

   removeArgument: function(n) {
      debugMsg("remove argument num ", n, " of ",this.inConn);
      let ok = true;
      if (this.inConn >= n) {
         let ct = 0;
         for (let i = this.uses.size()-1; i>=0; i--) {
            ct += this.uses.get(i).numOfConnectors(n);
         }
         debugMsg("removing ", ct, " connectors");
         if (ct>0) {
            ok = confirm('This argument is being used by '+ct+' connectors. Are you sure you want to remove it?');
         }
         if (ok) {
            this.inConn--;
            this.uses.map(function(block) {
               debugMsg("removing input",n,"from block",block.id);
               block.removeInput(n);
            });
         }
      }
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
      this.element = $('<div>').addClass('block');
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

      pipe.plumber.draggable(this.element, {containment: 'parent'});

      const self = this;
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
         let ct;
         for (ct=0; ct<inConn; ct++) {
            this.addInput(ct);
         }
      }
   },

   // *** using new endPoint object
   addInput: function(num) {
      if (num===undefined) num = this.inConnections();
      let e = Object.create(BlockEndpoint).init().setPos('top',num).addTo(this);
      debugMsg("added endpoint to block",this.id,e.ep.getParameters());
      this.inPoints.queue(e);
   },

   // *** using new endPoint object
   removeInput: function(num) {
      debugMsg("Removing input num ",num," of block ",this.id);
      let iP = this.inPoints.get(num);
      iP.remove();
      for (this.inPoints.remove(iP); num<this.inPoints.size(); num++) {
         debugMsg("shifting ",num);
         iP = this.inPoints.get(num);
         debugMsg("endPoint to shift details",iP.ep.getParameters());
         iP.setPos('top',num).updateProps();
      }
      debugMsg(this.id, " has ", this.inPoints.size(), " arguments");
   },

   numOfConnectors: function(num) {
      const input = this.inPoints.get(num);
      const c = input.isConnected()?1:0;
      debugMsg("Connections to remove: ",c);
      return c;
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
      let res;
      if (this.type.getExp) {

         // eval("function f() {let block = this.element; "+this.type.getExp+"}");
         // res = f();
         // would this work instead? It's neater+passes ESlint
         let fn = "(function(block) {"+this.type.getExp+"})(this.element)";
         debugMsg("evaluating: ",fn);
         res = eval(fn);
      }
      else {
         res = this.type.label;
      }
      return res;
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
            pos = this.getPosition();
      result.top = pos.top;
      result.left = pos.left;
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
      this.pipe.getFocus();
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
      this.pipe.plumber.repaint(this.element);
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
      if (this.properties.maxConnections == -1)
         return true
      else
         return false;
   },

   setPos: function(side,n) {
      let p;
      if (n==null) p=0.5
      else p = 0.1+n/3.5;
      debugMsg("endPoint pos",n,p);
      let a = [];
      switch (side) {
         case 'left': a = [0,p,-1,0]; break;
         case 'top': a = [p, 0, 0, 1]; break;
         case 'right': a = [1,p,1,0];
      }
      //debugMsg('anchors',a);
      return this.setAnchor(a);
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
      var uuid  = this.block.id+'_';
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
      if (this.isTarget())
         return this.ep.isFull();
      else
         return null;
   },

   findConnectedSource: function(connList) {
      // to find if a block is connected to this endPoint
      // first see if the outPoint is full
      // if yes, go through the blocks in the connList, and for each block,
      // find if the connList contains the matching source.
      // not an efficient process, but a limit of JSPlumb
      // a better setup for this might be to maintain this data
      // when the user creates/removes the connections
      let res = null;
      // let i=0;
      debugMsg("Checking connection");
      if (this.isConnected()) {
         debugMsg("there is one, seeking among", connList.length);
         for (let i=0; i<connList.length; i++) {
            let e = connList[i].endpoints;
            debugMsg("trying source",i, e[0].getUuid(), e[1].getUuid());
            let tep = e[1];
            if (this.ep===tep) {
               res=$(e[0].getElement()).attr("id");
               debugMsg("found block",res);
               break;
            }
         }
      }
      return res;
   },

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
   currentBE = Object.create(BlockEditor).init();
   $('#createNewBlock').attr('disabled','disabled');
}

const BlockEditor = {

   init: function() {
      debugMsg("making block editor");

      // Create dialog fro editor
      const inpt = $('');
      const form = '<form>Block: <input type="text" size=7 /></form>';
      const blockID = 'block-dialog';
      this.editor = $('<div>').attr('id',blockID);
      this.editor.append(form);

      // To move the form into the title bar, idea:
      // jboyblogger.wordpress.com/2014/09/12/how-to-use-html-for-jquery-dialog-title
      
      this.editor.dialog({width: 560, height:420, title:'Edit block'});

      // create and establish the draggable 'user block'
      this.setUserBlock(Object.create(CustomBlock).init(this));

      //this.userBlock.pipe.addEndBlock(true);
      
      // replaces addEndBlock - only the endPoint

      this.userBlock.pipe.blockList.add(blockID, this.userBlock.pipe);
      this.userBlock.pipe.type = {id: blockID};
      //this.userBlock.pipe.canvas.append(this.editor);
      this.userBlock.pipe.plumber.addEndpoint(this.editor, {
         anchors:[1,0.9,-1,0],
         uuid: "end_in0",
         isTarget: true,
         maxConnections: 1
      }, config.connectStyle);
      // end addEndBlock

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
      });

      this.editor.on('dialogresize', function() {
         userBlock.repaint();
      });

      const that = this;
      this.editor.droppable({
         tolerance: 'pointer',
         over: function() {
            mainPipe.canvas.droppable('disable');
         },
         out: function() {
            mainPipe.canvas.droppable('enable');
         },
         drop: function(event,ui) {
            that.drop(ui.draggable,ui.offset);
         }
      });
   },
   
   drop: function(dropped, offset) {
      this.userBlock.pipe.getFocus();
      if (dropped.hasClass('blockType')) {
         const edPos = this.editor.offset();
         const t = offset.top-edPos.top;
         const l = offset.left-edPos.left;
         const b = focusPipe.addBlock(dropped,{top:t, left:l}); // b is the block
         focusPipe.deselectAllBlocks();
         focusPipe.selectBlock(b);
         mainPipe.canvas.droppable('enable');
      }
   }

}

const CustomBlock = {

   init: function(editDialog) {
      // this is block-specific
      debugMsg("making block");
      this.name = this.edGen.next();
      this.num = this.edGen.num();
      this.argGen = Object.create(TokenGenerator).init('arg'); // makes argNames (arg1, arg2...)
      this.argList = Object.create(Bag).init(); //[]; // list of arguments
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

   rename: function(newName) {
      debugMsg("renaming ",this.name," to ",newName);
      if (this.customType.changeLabel(newName)) {
         stateStore.renameBlock(this.name,newName);
         this.name = newName;
         this.icons();
      }
   },

   newArgument: function(block) {
      let inpt = block.element.find('form > input')[0];
      let argName = this.argGen.next();
      inpt.value = argName;
      this.argList.queue(block);
      // this.argsNum++;
      this.customType.addArgument();
      debugMsg("new argument ",block.id,argName);
   },

   isArgument: function(block) {
      let result = this.argList.contains(block);
      debugMsg("Block ", block.id, " in argList?",result);
      return result;
   },

   newType: function() {
      let cT = Object.create(BlockType).init(this.name,{args:this.argList.size()});
      debugMsg("adding type");
      cT.addTo({left:"10px"},$("#Custom"));
      return cT;
   },

   deleteArgument: function(arg) {
      let ok = false;
      if (this.argList.contains(arg)) {
         let i = this.argList.find(arg);
         ok = this.customType.removeArgument(i);
         if (ok) {
            this.argList.remove(arg);
            // this.argsNum--;
         }
      }
      return ok;
   },

   done: function() {
      this.saveDefun();
      $('#createNewBlock').removeAttr('disabled','disabled');
   },

   delete: function() {
      // need to 'unsave...'
      $('#createNewBlock').removeAttr('disabled','disabled');
      this.customType.element.remove();
      stateStore.removeBlock(this.name);
   },

   saveDefun: function() {
      let def = this.defun();
      if (def != undefined) {
         debugMsg("new function: ",this.name, def);
         custom_functions.set(this.name, def);
      }
   },

   defun: function() {
      this.pipe.useDefaultArguments = false;
      let res = this.pipe.getFullExpression('block-dialog');
                           // block-dialog = the div the endPoint is tied to
      this.pipe.useDefaultArguments = true;
      if (res != undefined) {
         res = ["defun", this.name, this.argList.map(a => a.getExpression()), res];
      }
      debugMsg(res);
      return res;
   },

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

      const that = this;
      del.on('click', function(e) {
         e.stopPropagation();
         edit.remove();
         //debugMsg(that);
         that.bE.userBlock.delete();
         that.bE.editor.dialog('close');
         that.pipe = undefined;
         //that.remove();
         // more needed!!
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
         if (currentBE != that.bE) {
            debugMsg('change edited block');
            if (currentBE) currentBE.editor.dialog('close');
            currentBE = that.bE;
         }
         if (currentBE.editor.is(":hidden")) {
            debugMsg('show editor');
            currentBE.editor.dialog('open');
            that.repaint();
         }
      });

      copy.on('click', function(e) {
         e.stopPropagation();
         // make a copy
         debugMsg('copy block');
         // let oldBlock = that;
         currentBE.editor.dialog('close');
         editBlock();
         const newName = that.name+'_copy'
         currentBE.userBlock.rename(newName);
         currentBE.editor.find("input").val(currentBE.userBlock.name);
         for (let bID in that.pipe.blockList.list) {
            if (bID!='end') {
               const oB = that.pipe.blockList.get(bID);
               debugMsg('old block', bID);
               const oType = oB.type.element;
               const oPos = oB.getPosition();
               debugMsg(oPos);
               const newB = currentBE.userBlock.pipe.addBlock(oType,oPos);
               oB.copyStateTo(newB);
            }
         }
         const connections = that.pipe.plumber.getConnections();
         connections.map(
            conn => {
               debugMsg("Connecting", conn.sourceId, "to", conn.targetId);
               const epout = conn.endpoints[0].getUuid(),
                     epin = conn.endpoints[1].getUuid(); 
               debugMsg("Connecting", epout, "to", epin);
               currentBE.userBlock.pipe.plumber.connect({uuids:[epout,epin]});
            }
         );
         stateStore.copyBlock(that.name,newName);
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
      
      return this;
   },

   load: function() {
      // this.loadBlockList(); // no need?
      this.loadBlocks();
      this.loadMainPipe();
      this.loadStateGUI();
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
      this.setItem(blockName,this.blocks.get(blockName));
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
      this.setItem("mainPipe",this.mainPipe);
   },

   saveStateGUI: function() {
      this.setItem("stateGUI",this.stateGUI);
   },

   loadBlocks: function() {
      const len = localStorage.length, bs = [];
      for (let i=0 ; i < len ; i++) {
         let bN = this.key( i );
         if (bN != 'mainPipe' && bN != 'stateGUI') {
            bs.push(this.loadBlock(bN));
         }
      }
      bs.map(f=>f());
   },

   loadBlock: function(blockName) {
      // this function loads the block in two stages
      // it creates the block and sets arguments as it runs
      // it then returns a function which when executed,
      // completes the block rebuilding.
      const blockString = this.getItem(blockName);
      this.blocks.set(blockName,blockString);
      currentBE = Object.create(BlockEditor).init();
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

   removeBlock: function(customBlock) {
      this.blocks.remove(customBlock);
      this.removeItem(customBlock);
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
      // returns the set of blocks as a JSON string
      const len = localStorage.length, result = {};
      for (let i=0 ; i < len ; i++) {
         let k = this.key( i );
         if (k != 'stateGUI') { // all keys except for stateGUI
            result[k] = this.getItem(k);
         }
      }
      return result;
   },

   key: function(i) {
      const k = localStorage.key(i);
      const l = this.prefix.length;
      return k.substring(l);
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
const custom_functions = Object.create(Collection).init(); // new collection();

// Maintain state in local storage
const stateStore = Object.create(stateSaver).init("local");

/* start:
   - load the file of predefined functions
   - launch initialisation
*/
function initialise() {
   // initialise the GUI list of block types

   const pipeCanvas = $('#pipeContainer');

   mainPipe = Object.create(PipeInstance).init(pipeCanvas);
   mainPipe.getFocus(); // main is in focus by default

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
         mainPipe.getFocus();
         if (blockType.html()!='Argument') {
            const b = mainPipe.addBlock(blockType,ui.position); // b is the block
            mainPipe.deselectAllBlocks();
            mainPipe.selectBlock(b);
         }
      }
   });

   // del = delete selected block(s); backspace = suppress navigation
   $('html').keydown(function(e){
      // check
      if(e.keyCode == 46 && e.target==document.body) { // del key and body (not form)
         debugMsg("deleting");
         focusPipe.deleteSelectedBlocks();
      } else if (e.keyCode == 8) {
         // code 8 = backspace: suppress unless editable element
         const $target = $(e.target||e.srcElement);
         if (!$target.is('input,[contenteditable="true"],textarea')) { e.preventDefault(); }
      }
   });

   // add argType block type to custom functions
   const argType = {
      label: "Custom",
      args: 0,
      blockCode : "<form><input type='text' size=3/><form>",
      dropCode: "currentBE.userBlock.newArgument(block);",
      getExp: "let inpt = block.find('form > input')[0]; return inpt.value;",
      output: -1 // number of output connections is illimited
   }

   // last section, custom blocks

   const custom = blockTypeList.addSection("Custom");
   custom.append('<button id="createNewBlock" onClick="editBlock();">New block</button>');
   Object.create(BlockType).init('Argument',argType).addTo({top:2, left:"-30px"}, custom);
   // add blockType to accordion

   $( "#accordion" ).accordion( {
      activate: function( event, ui ) {
         const active = $( "#accordion" ).accordion( "option", "active" );
         stateStore.updateAccordion(active);
      }
   } ) // {heightStyle: "fill");

   stateStore.load();

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
});


<?
/*

(plus 2 3) in JSON = ["plus", 2, 3]

(1 2 3) in JSON = [1, 2, 3]

Examples of expression that ought to be interpretable:

[
  ["defun", "square", ["x"], ["times", "x", "x"]],
  ["square", 2]
]

result:
   function square(x) { return x*x; }
   square(2);

[
  ["defun", "fac", ["n"], ["if", ["lt", "n", 2], 1, ["times", "n", ["fac", ["minus", "n", 1]] ]]],
  ["fac", 10]
]

result:
   function fac(n) {return lt(n,2)?1:times(n,fac(n-1));}
   fac(10);

*/

/*
Set of predefined functions
predefined functions both define the gui blocks
and this compilation, so the functions are loaded in the editor

as well as functions, some substititions are allowed
this is still in progress.
a call is either substitution or function;
substitutions may have prerequisite functions; but not prerequisite substitutions (?)
substitutions could uncoupling language specific structures
and replace special cases of the compiler engine
like conditionals and possibly function definition

A stack of defined vars (setq) is also maintained
*/


// $counted - list of functions in use (to not repeat them)
$counted = [];

// $ready_replacements - list of substitutions already parsed

// list of variables in use (to parse them)
// with encapsulated functions for handling the list


// Code = string containing code of functions to include in result
class Code {
    
    static $text = "";

    static function clear() { self::$text = ""; },
    static function line($lin) { self::$text += $lin + "\n\n"; }    
}

function compile(Exp) {
   Code::clear();
   Code::line("// Automatically generated code");
   counted = [];
   tokens.clear();
   ready_replacements = [];
   $call = encode(Exp);
   Code::line("process("+call+");");
   return Code::text;
}

function encode(Exp) {
    $res = "";
    
    if (Exp instanceof Array) {
        debugMsg(Exp+" is an Array");
    // case 1: expression is an empty array
        if (Exp.length==0) res = [];
        else { // non-empty array
            $H = Exp[0];
            
    // case 2: expression is a function definition
            if (H == "defun") {
                defun(Exp);
            }
            
    // case 2a: expression is a variable setting
            else if (H == "setq") {
                $tok = Exp[1];
                tokens.add(tok);
                Code::line("$"+tok+" = "+encode(Exp[2])+";");
            }
    
    // case 3 predefined_replacements
            else if (H in predefined_replacements) {
                $s = getSubstitutor(H);
                Exp.shift();
                // should there be validation on number and type of arguments?
                Arguments = encodeEach(Exp);
                res = s(Arguments);
            }
            else if (H in predefined_functions) {
    // case 4: expression is a function call
                // getOperator returns the string defining the function
                $op = getOperator(H);
                Exp.shift();
                // should there be validation on number and type of arguments?
                Arguments = encodeEach(Exp);
                res = op(Arguments); //H+"("+Arguments.join(",")+")";
            } else
    // case 5: expression is any other array - treated like a data array
                res = "["+encodeEach(Exp)+"]";
        }
    }
    else if (is_string(Exp)) {
    // case 6: expression is a known variable
        if (tokens.contain(Exp)) res = Exp
    // case 7: expression is a string
        else res = '"'+Exp+'"';
    }
    // case 8: expression is anything else - left unprocessed - works for number, boolean, null
    else res = Exp;
    
    // done
    return res;
}

function encodeEach(E) {
    debugMsg("encoding each of "+E);
    if (E instanceof Array) {
        $Res = [];
        if (E.length>0) {
            debugMsg("encoding "+E[0]);
            $First = encode(E[0]);
            E.shift();
            $Res = encodeEach(E);
            if (First != "") {Res.unshift(First);}
        }
       return Res;
    }
    else throw "Should get an array, received "+JSON.stringify(E);
}

// defun adds necessary code for the function definition and updates the list of functions available
// and the list of functions in use
// the syntax is javascript: funtion foo(arguments) {return body;}
function defun(Exp) {
    // adds a function definition to the "predefined functions" JSON list
    $name = Exp[1];
    $args = Exp[2];
    $f = {};
    f["args"] = args.join(", ");
    predefined_functions[name] = f;
    counted.push(name);
    tokens.addAll(args); // tokens list is filled with the function arguments
    debugMsg(tokens);
    $body = "return "+encode(Exp[3])+";";
    f["body"] = body;
    tokens.removeAll(args);
    Code::line("$"+ name + " = function (" + f["args"] + ") {" + body +"}");
}

function getSubstitutor($x) {
    $s;
    
    if ($ready_replacements[$x]) {
        $s = $ready_replacements[$x];
    }
    else {
        $rX = $predefined_replacements[$x];
        
        // parse rX.args and get strings to replace in the substitution
        $args = array_map("trim", explode($rX['args'],','));
        
        // then parse rX.js - get the substrings that start with substitutions
        $reps = explode(rX["php"],'@');
        
        // each string in reps (bar the first) starts with one of the strings in args
        // indexes is a list e.g. [0,1,2] of which argument, by number, must be inserted
        $indexes = [];
        // results_parts is a list of strings that need to be concatenated
        $result_parts = [reps[0]]; // ['','?',':',''] ;

        for ($i=1; i<reps.length; i++) {
            ind = startsWithWhich(args, reps[i]); // find the index of the argument to use next
            indexes.push(ind); // add to indexes array
            res_part = reps[i].slice(args[ind].length); // find the next substring
            result_parts.push(res_part);
        }

        // return a function that makes the subtitition
        // the function uses indexes and results_parts which are in its environment
        // (thank you closure!)
        s = function(bits) {
                res = '';
                for ($i=0; i<indexes.length; i++) {                
                    res += result_parts[i]+bits[indexes[i]];
                }
                res += result_parts[i];
                return res;
            };
        // add prerequisites to the code
        if (rX.requires) {
            $pre = rX.requires.map(getOperator);
            Code::line(pre.join(""));
        }

        ready_replacements[X] = s;
    }

    return s;
}

// start with which takes a list of tokens and a string to check.
// It returns the index of the token with which the string starts
// if the string starts with none of them, it returns null.
function startsWithWhich($toks, $str) {
    for ($which=0; $which<count($toks); $which++) {
        if (strpos($str, $toks[$which])==0) {
            return $which;
        }
    }
    debugMsg("Not found any $toks in $str");
    return null;
}

function getOperator($x) {
    
    if (in_array($x,$counted)==0) {
        $fX = $predefined_functions[$x];
        array_push($counted,$x);

        // concatenate function definition
        Code::line("function $x(". $fX['args'] .") {". $fX['body'] ."}");

        // find pre-requisites
        if (is_set($fX['requires'])) {
            $pre = array_map($fX['requires'],'getOperator'); //getOperator = the function
        }
    }

    return function ($args) {return "$x(".array_join($args,",").")";};
}

// needs work
function process($exp) {
   // calls the compiled instructions, respecting the structure, and returns a string to display.
   // needs thinking - best would be to send PHP code to a virtual machine 
/*
    $res;

    if ($exp instanceof Array) {
        $res = $exp.map(process);
    }
    else {
        $res = eval($exp);
        if (typeof(res == "undefined")) res = Exp;
    }
    // done
    return $res;
*/
}

// list of variables in use (to parse them)
// with encapsulated functions for handling the list
class Tokens {
    
    // static or in __construct??
    static $list = [];
    
    static function clear() { self::$list=[]; }
    
    /* not needed (?)
    static function contain($tok) {
        return in_array($tok,self::$list);
    }
    */
    
    static function add($tok) {
        array_unshift(self::$list,$tok);
        return self;
    }

    static function addAll($toks) {
        debugMsg($toks); 
        array_map('self::add',$toks);
    }
    
    static function remove($tok) {
        if (in_array($tok,self::$list)) {
            return false;
        } else {
            array_splice(self::$list,array_search(self::$list,$tok),1)
            return self;
        }
    }
    
    static function removeAll($toks) {
        array_map('self::remove',$toks);
    }
    
    static shift: function ($n=1) {
        do {array_shift(self::$list);} while (n-->0);
        return self;
    }
}

// work statically - no need
//$tokens = new Tokens();

function debugMsg($msg) {
    $debug = false; // set to true to turn on debugging
    if ($debug) echo(print_r($msg)+'\n');
}

?>
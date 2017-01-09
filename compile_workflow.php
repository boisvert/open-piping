<?php

error_reporting(E_ALL ^ E_WARNING);
//xdebug_disable();

ini_set( 'magic_quotes_gpc', 0 );

$predefined_functions = array();
$counted = array(); // list of functions in use (to not repeat them)

// Possible substitutions
debug_class('Set');
debug_class('Setof_Replacements');
debug_class('Replacement');
$replacements = new Setof_Replacements();
$ready_replacements = array();


// set of variables
// Should it be a set (no duplicates)? or a stack?
$tokens = new Set();

if (!isset($_POST["exp"])) die("No data");

$e = stripslashes($_POST["exp"]);

debugMsg("PHP interpreter");

$exp = json_decode($e);

get_json_data('functions.json');

compile($exp);

echo(Code::$text);

function get_json_data($file) {
    
    global $predefined_functions;
    global $replacements;
        
    $json = file_get_contents($file);
    $json = json_decode($json,true);
    
    $predefined_functions = $json['php'];
    debugMsg($predefined_functions);
    $replacements->populate($json['replace']);
    debugMsg($replacements);

}

function compile($exp) {
    global $counted;
    global $ready_replacements;
    global $tokens;
    
    Code::clear();
    Code::line("// Automatically generated code");
    $counted = array();
    $tokens->clear();
    $ready_replacements = array();
    $call = encode($exp);
    Code::line("process($call);");
    return Code::$text;
}

function encode($exp) {
    global $predefined_functions;
    global $tokens;
    global $replacements;

    $res = "";
    debugMsg($exp);

    if (is_array($exp)) {
    // case 1: expression is an empty array
        if (count($exp)==0) {
            $res = "[]";
        }
        else { // non-empty array
            $H = $exp[0];

    // case 2: expression is a function definition
            if ($H == "defun") {
                debugMsg("is a function definition");
                defun($exp);
            }

    // case 2a: expression is a variable setting
            else if ($H == "setq") {
                $tok = '$'.$exp[1];
                $tokens->add($tok);
                Code::line($tok.' = '.encode($exp[2]).';');
            }

    // case 3 predefined_replacements
            else if ($replacements->match($H)) {
                debugMsg('needs replacement');
                $rep = $replacements -> getMatch($H);
                $rep -> prepare();
                array_shift($exp);
                // should there be validation on number and type of arguments?
                $Arguments = encodeEachInArray($exp);
                $res = $rep -> replace($Arguments);
                debugMsg("Replacement gives $res");
            }

    // case 4: expression is a function call
            else if (isset($predefined_functions[$H])) {
                // getOperator returns the string defining the function
                debugMsg("is a function call");
                getOperator($H);
                array_shift($exp);
                // should there be validation on number and type of arguments?
                $args = encodeEach($exp);
                $res = op($H, $args);
            }

    // case 5: expression is any other array - treated like a data array
            else {
                debugMsg(" is an Array");
                $res = "[".encodeEach($exp)."]";
            }
        }
    }
    else if (is_string($exp)) {
    // case 6: expression is a known variable
        if ($tokens->contain('$'.$exp)) {
            debugMsg(" is a variable");
            $res = '$'.$exp;
        }
    // case 7: expression is a string
        else {
            debugMsg(" is a string");
            $res = '"'.$exp.'"';
        }
    }
    // case 8: expression is anything else - left unprocessed - works for number, boolean, null
    else $res = $exp;

    // done
    return $res;
}

function encodeEach($E) {
    if (is_array($E)) {
        if (count($E)>0) {
            $First = encode($E[0]);
            array_shift($E);
            $Result = encodeEach($E);
            if ($Result == "") {
                $Result = $First;
            }
            else {
                if ($First != "") {$Result = "$First, $Result";}   
            }
            debugMsg("pop $Result");
        } else {
            $Result = "";
        }
        return $Result;
    }
    else {
        debugMsg("Should get an array, received ".$E);
        die("Stopping here");
    }
}

function encodeEachInArray($E) {
    if (is_array($E)) {
        if (count($E)>0) {
            $First = encode($E[0]);
            array_shift($E);
            $res = encodeEachInArray($E);
            array_unshift($res, $First);
            debugMsg($res);
        } else {
            $res = array();
        }
        return $res;
    }
    else {
        debugMsg("Should get an array, received ".$E);
        die("Stopping here");
    }
}


// start with which takes a list of tokens and a string to check.
// It returns the index of the token with which the string starts
// if the string starts with none of them, it returns null.

function defun($exp) {
    global $counted;
    global $tokens;
    // adds a function definition to the "predefined functions" JSON list

    global $predefined_functions;
    $name = $exp[1];
    $args = array_map('add_dollar',$exp[2]);
    $tokens->addAll($args); // tokens list is filled with the function arguments
    $f = array();
    $f['args'] = implode(", ",$args);
    debugMsg("function arguments");  debugMsg($f['args']);
    $predefined_functions[$name] = $f;
    array_push($counted,$name);
    $body = "return ".encode($exp[3]).";";
    $f["body"] = $body;
    debugMsg("function body");  debugMsg($body);
    $tokens->removeAll($args);
    Code::line("function $name(". $f['args'] . ") {".$body."}");
}

function add_dollar($str) {return '$'.$str;}

function getOperator($x) {

    global $counted;
    global $predefined_functions;

    if (in_array($x,$counted)==0) {
        $fX = $predefined_functions[$x];
        array_push($counted,$x);

        // concatenate function definition
        Code::line("function $x(". $fX['args'] .") {". $fX['body'] ."}");

        // find pre-requisites
        if (isset($fX['requires'])) {
            array_map($fX['requires'],'getOperator'); //getOperator = the function
        }
    }
}

function op($H,$args) {
    debugMsg("Function call is  $H ( $args )");
    return $H. "(" . $args . ")";
}

function debugMsg($m) {
    $debug = false; // set to true to turn on debugging
    if ($debug) {

        if (is_string($m) || is_scalar($m)) {
            echo('// ');
            echo($m);
        }
        else if (is_array($m)) {
            echo('/*');
            print_r($m);
            echo('*/');
        }
        else {
            echo('/*');
            print_r((object) $m);
            echo('*/');            
        }
        echo("\r\n");
    }
}

function debug_class($c) {
    if (class_exists($c)) {
        debugMsg("Class OK $c");
    } else {
        debugMsg("No class $c");
    }
}

/*
$replacements = array(); // list of allowed substitutions
$ready_replacements = array(); // list of substitutions already parsed
*/

class Replacement {
 
    public $for;
    private $use;
    private $args;

    private $requirements = array();
    private $ready = false;
    
    private $result_parts = array();
    private $indexes = array();

    function __construct($key,$value) {
        $this->for = $key;
        $this->args = $value['args'];
        $this->use = $value['php'];
        if (isset($value['requires'])) { 
            $this->requirements = $value['requires'];
        }
    }

    public function prepare() {
        
        if (!$this->ready) {

            debugMsg('preparing replacement');
            debugMsg($this->for);
            // parse rX.args and get strings to replace in the substitution
            $args = array_map('trim', explode(',', $this->args));
            debugMsg($args);

            // then parse rX.js - get the substrings that start with substitutions
            $rep_parts = explode('@',$this->use);
            debugMsg($rep_parts);

            // each string in rep_parts (bar the first) starts with one of the strings in args
            // indexes is a list e.g. [0,1,2] of which argument, by number, must be inserted
            $indexes = array();
            // results_parts is a list of strings that need to be concatenated
            $this->result_parts = array($rep_parts[0]); // ['','?',':',''] ;
            array_shift($rep_parts);

            foreach ($rep_parts as $part) {
                $ind = $this -> startsWithWhich($args, $part); // find the index of the argument to use next
                array_push($this->indexes,$ind); // add to indexes array
                $part = substr($part,count($args[$ind])); // find the next substring
                array_push($this->result_parts,$part);
            }
            debugMsg($this->result_parts);
            debugMsg($this->indexes);

            // add prerequisites to the code
            if (isset($rX['requires'])) {
                $pre = array_map(getOperator, $rX['requires']);
                Code::line(implode($pre,""));
            }

            $this -> ready = true;
        }

        //return $s;
    }

    private function startsWithWhich($toks, $str) {
        for ($which=0; $which<count($toks); $which++) {
            if (strpos($str, $toks[$which])===0) {
                return $which;
            }
        }
        return -1;
    }

    public function replace($bits) {
        debugMsg("replacing ");
        debugMsg($bits);
        debugMsg("into $this->use");
        $res = '';
        for ($i=0; $i<count($this->indexes); $i++) {                
            $res .= $this->result_parts[$i].$bits[$this->indexes[$i]];
            debugMsg($res);
        }
        $res .= $this->result_parts[$i];
        return $res;
    }

}

// Code = string containing code of functions to include in result
// Will have to reconsider use of static
// see 'getInstance' for the singleton pattern if need be
class Code {
    
    static $text = "";

    static function clear() { 
        self::$text = "";
    }

    static function line($lin) {
        debugMsg("Added to code: $lin");
        self::$text .= $lin."\n\n"; 
    }

}

// list of variables in use (to parse them)
// with encapsulated functions for handling the list
class Set {
    
    // static or in __construct??
    private $list = array();
    
    public function clear() {
        $this->list = array();
    }
    
    public function contain($tok) {
        return in_array($tok,$this->list);
    }
    
    public function add($tok) {
        if (!$this->contain($tok)) {
            array_unshift($this->list,$tok);
        }
        return $this;
    }

    public function addAll($toks) {
        array_map(array($this,'add'),$toks);
        debugMsg($this);
        return $this;
    }
    
    public function remove($tok) {
        if (in_array($tok,$this->list)) {
            return false;
        } else {
            array_splice($this->list,array_search($this->list,$tok),1);
            return $this;
        }
    }

    public function removeAll($toks) {
        array_map(array($this,'remove'),$toks);
    }

    public function shift($n=1) {
        do {
            array_shift($this->list);
            $n--;
        } while ($n > 0);
        return $this;
    }

}

class Setof_Replacements {
    // ought to extend set, but PHP class system is confusing!

    private $list = array();

    public function __construct() {
        $this->clear();
    }

    public function clear() {
        $this->list = array();
    }

    public function populate($json_reps) {
        foreach ($json_reps as $key => $value) {
            if (isset($value["php"])) {
                $this->add(new Replacement($key,$value));
            }
        }
    }

    public function add($rep) {
        if (!$this->contain($rep)) {
            array_unshift($this->list,$rep);
        }
        return $this;
    }

    public function match($forStr) {
        //debugMsg('looking for a replacement for');
        //debugMsg();
        foreach($this->list as $rep) {
            if ($rep->for == $forStr) return true;
        }
        return false;
    }

    public function getMatch($forStr) {
        //debugMsg('looking for a replacement for');
        //debugMsg();
        $res = null;
        foreach($this->list as $rep) {
            if ($rep->for == $forStr) return $rep;
        }
        return null;
    }

    public function contain($rep) {
        return $this->match($rep->for);
    }
    
}

?>
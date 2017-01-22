var express = require('express');
var fileUpload = require('express-fileupload');
var mv = require('mv');
var AWS = require('aws-sdk');
var fs = require('fs');
var watson = require('watson-developer-cloud');
var app = express();

app.use(express.static('public'));

AWS.config.loadFromPath('./awscreds.json');
var polly = new AWS.Polly();
var s3 = new AWS.S3();

app.set('port', (process.env.PORT || 5000));

var defaultFolder = './files/';
var fname = "TestDocument2.pdf";
var vname = "Alexa";
var bucketname = "hackdavis";

app.use(fileUpload());


var document_conversion = watson.document_conversion({
  username:     '38aa246c-a29d-4076-a567-29a35f32e91c',
  password:     'MRXGyQdxWq7w',
  version:      'v1',
  version_date: '2015-12-15'
});


function checkIfFileExists(input, directory){
	var str = [];

	fs.readdir(directory, (err, files) => {
  		files.forEach(file => {
    		if(input == file) {
    			return true; //false;
    		}
  		});
	});
	return true;
}


function listFilesInDirectory(directory, callback) {
	var filelist = [];
	fs.readdir(directory, (err, files) => {
  		files.forEach(file => {
    		filelist.push(file);
  		});
  		callback(filelist);
	});
}

function convertToString(fname, callback) {
	//var fname = "TestDocument2.pdf";
	document_conversion.convert({
	  file: fs.createReadStream(fname),	// need to input document here to convert
	  conversion_target: 'answer_units',
	}, function (err, response) {
	  if (err) {
	    console.log(err);
	    return "";
	  } else {
	  	var text = response.answer_units[0].content[0].text;
	    console.log(text); // gets the text
	    callback(text);
	    return text;
	  	//console.log(response);
	  }
	});
}

function sendStringToAlexa(str) {
	return {
		type: 'text',
		text: str
	};
}

function convertToMp3(str, callback){
	var params = {
		OutputFormat: 'mp3',
		Text: str,
		VoiceId: vname
	};

	polly.synthesizeSpeech(params, callback);
}

function uploadStreamToS3(audio, callback) {
	var params = {
		Bucket: bucketname,
		Key: 'alexa_audio.mp3',
		Body: audio
	};
	s3.upload(params, callback);
}

app.get('/', function(request, response) {
  response.send('hello worldannoying as fuck \n hihihihihihi victor, hows the app? \n are you using the camera yet?');
});

app.post('/addFile', function(req, res) {

//	if (!req.files) {
  //  	res.send('No files were uploaded.');
    //	return;
  	//}

  	console.log(JSON.stringify(req.files));

  	var checkFile = checkIfFileExists("", defaultFolder);

  	res.send(JSON.stringify({ status: "success"}));
});

app.get('/getFile', function(req,res) {

	convertToString(defaultFolder+fname, function(textStr) {
		var alexaObj = sendStringToAlexa(textStr);
		if(vname == "Alexa") {
			res.send({
				id: 'Alexa',
				title: fname,
				type: 'text',
				text: textStr
			});
		}
		else {
			convertToMp3(textStr, function(err, data) {
				if(err) console.log(err, err.stack);
				else {
					uploadStreamToS3(data.AudioStream, function (err, data) {
						console.log("S3 Link for mp3: "+data.Location);
						res.send({
							id: vname,
							title: fname,
							type: 'audio',
							stream: data.Location
						});
					});
				}
			});
		}
	});

});

app.get('/listFiles', function(req,res){
	listFilesInDirectory(defaultFolder, function(arr){
		res.send(arr.toString());
	});
});

app.get('/listVoices', function(req,res){
	polly.describeVoices({"LanguageCode": "en-US"}, function(err, data){
		var voices = ['Alexa'];
		var voice = data;

		if (err) console.log(err, err.stack);
		else
		{
			//console.log(data);
			for (var i = 0; i < voice.Voices.length; i++)
			{
				voices.push(voice.Voices[i].Id);
				console.log(voice.Voices[i].Id);
			}

			res.send(voices.toString());
		} 


	});
});

app.get('/selectFile', function(req, res){
	var fnamelocal = req.query.fname;
	var oldfname = fname;
	if (fnamelocal != "" && fnamelocal)
	{
		fname = fnamelocal;
	}
	else {
		res.send("Current selected file: "+fname);
	}

	res.send("Changed from "+oldfname+" to "+fname+".");
});


app.get('/selectVoice', function(req, res){
	var newVoice = req.query.name;
	var oldVoice = vname;
	if (newVoice != "" && newVoice)
	{
		vname = newVoice;
	}
	else {
		res.send("Current selected file: "+vname);
	}

	res.send("Changed from "+oldVoice+" to "+vname+".");
});

app.get('/introVoice', function(req,res) {
	textStr = "Hi, I am "+vname+".";
	if(vname == "Alexa") {
		res.send({
			id: 'Alexa',
			title: fname,
			type: 'text',
			text: textStr
		});
	}
	else {
		convertToMp3(textStr, function(err, data) {
			if(err) console.log(err, err.stack);
			else {
				uploadStreamToS3(data.AudioStream, function (err, data) {
					console.log("S3 Link for mp3: "+data.Location);
					res.send({
						id: vname,
						title: fname,
						type: 'audio',
						stream: data.Location
					});
				});
			}
		});
	}
});

app.post('/uploadFile', function (req, res) {
	//res.send("response");
	var file;
 
  	if (!req.files) {
    	res.send('No files were uploaded.');
    	return;
  	}
 
  // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file 
  //sampleFile = req.files.sampleFile;
  file = req.files.newDoc;
 console.log(file);
  // Use the mv() method to place the file somewhere on your server 
  file.mv('./files/' + req.files.newDoc.name, function(err) {
    if (err) {
      res.status(500).send(err);
    }
    else {
      res.send('File uploaded!');
    }
  });
});

   

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});





//app.use(express.static(__dirname + '/public'));

// views is directory for all template files
//app.set('views', __dirname + '/views');
//app.set('view engine', 'ejs');


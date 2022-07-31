/*
 * Copyright (c) 2017, Texas Instruments Incorporated
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * *  Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 *
 * *  Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * *  Neither the name of Texas Instruments Incorporated nor the names of
 *    its contributors may be used to endorse or promote products derived
 *    from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
 * OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
 * EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */


// On send command button press this function will issue cmds from the plots tab to "advanced commands" tab
function onSendCmdsPlotsTab() {
    var dynamicInput = new mmWaveInput();
    clearErrorMessages();
    var receiveCmds = templateObj.$.ti_widget_textbox_dyn.value;
    var cmds = receiveCmds.split(/\r?\n/);

    // This method is used to filter empty lines from array
    function removeEmptyLine(line) {
        return line != "";
    }
    var cmd = cmds.filter(removeEmptyLine);
    var txt1 = "Allowed Commands are: ";

    var tempCmd = [];
    cmd = cmd.map(function(cmd) {
        return cmd.replace(/ {1,}/g," ");
    });

    //Here it filters list of all cfarCfg commands.For example 16xx will have range, doppler it will return both cfar commands
    var cfarCmds = cmd.filter(function(cfrcmd) {
        if (cfrcmd.indexOf("cfarCfg") > -1) {
            return cfrcmd;
        }
    });

    var cfarFovCfgCmds = cmd.filter(function(cfarFovCfgCmd)
    {
        if (cfarFovCfgCmd.indexOf("cfarFovCfg") > -1)
        {
            return cfarFovCfgCmd;
        }
    });
    if (ConfigData !== undefined){
        for(var i = 0; i < cmd.length && !errorflag; i++) {
            var cmdlist = list_of_realtime_cmds[ConfigData.platform];
            var invalidCmd = true;
            var errorflag = false;
            for (var j = 0; j < cmdlist.length; j++){
                var splitCmd= cmd[i].split(" ");
                if(splitCmd[0]==cmdlist[j]){
                    tempCmd.push(cmd[i]);
                    //Passing 'Params' to execute validations
                    invalidCmd = false;
                    var tempParams = validationsCfg.validateCfg(tempCmd, ConfigData.platform, ConfigData.sdkVersionUint16, Params, true);
                    for (var k = 0; k < ConfigData.cmdLines.length; k++) {

                        if (ConfigData.cmdLines[k].indexOf(cmdlist[j]) > -1) {

                            if (ConfigData.cmdLines[k].indexOf("cfarCfg") > -1) {
                                //To update the latest cfarCfg values(range,doppler) in ConfigData.lines
                                cfarCmds.map(function(cfrCommand){
                                    if(ConfigData.cmdLines[k].substring(0,12) == cfrCommand.substring(0,12)) {
                                        ConfigData.cmdLines[k] = cfrCommand;
                                    }

                                });
                            } 
                            else if (ConfigData.cmdLines[k].indexOf("cfarFovCfg") > -1)
                            {
                                cfarFovCfgCmds.map(function(cfarFovCfgCommand)
                                {
                                    if (ConfigData.cmdLines[k].substring(0, 15) == cfarFovCfgCommand.substring(0, 15)) {
                                        ConfigData.cmdLines[k] = cfarFovCfgCommand;
                                    }

                                });
                            } 
                            else 
                            {
                                ConfigData.cmdLines[k] = cmd[i];
                            }
                        }
                    }
                    break;
                }
            }
            if(invalidCmd){
                templateObj.$.ti_widget_label_dynamic_status_message.visible = true;
                templateObj.$.ti_widget_label_dynamic_status_message.fontColor = "#ff0000";
                templateObj.$.ti_widget_label_dynamic_status_message.label = txt1 + cmdlist.join('\n');
                errorflag = true;
            }
        }
        if(tempParams){
            dynamicCMDSender(tempCmd);
        }
    }
}

function dynamicCMDSender (cmds){
    var dynamicInput = new mmWaveInput();
    cmd_sender_listener.setCfg(cmds, true, false, function (error) {
        if (error) {
            templateObj.$.ti_widget_label_dynamic_status_message.visible = true;
            templateObj.$.ti_widget_label_dynamic_status_message.fontColor = "#ff0000";
            templateObj.$.ti_widget_label_dynamic_status_message.label = "Invalid usage of the CLI command";
        } 
        else {
            var RangeLinearVal = '';
            var DooplerLinearVal = '';
            // Update the real-time tuning based on the commands passed in Advanced Commands text area
            realTimeDynamicControls(cmds, ConfigData.platform, dynamicInput);
        }
    });
}

//Issuing dynamic commands cfar,doppler, peakgrouping,clutter removal for real time tuning in plots tab.
function realTimeTuning(inputChange, val) {
    var cmdlist = list_of_realtime_cmds[ConfigData.platform];
    var dynamicInput = new mmWaveInput();
    var validCmd = true;
    clearErrorMessages();
    Input = {
        platform: Params.platform,
        Num_Virt_Ant: ConfigData.Num_Virt_Ant,
        sdkVersionUint16: ConfigData.sdkVersionUint16
    }
    //P = {
    //   lines: []
    // }
    var cmd;
    var cfarFovCfgCmds = ConfigData.cmdLines.filter(function(cfarFovCfgCmd) {
        if (cfarFovCfgCmd.indexOf("cfarFovCfg") > -1) {
            return cfarFovCfgCmd;
        }
    });
    
    switch (inputChange) {
        case "cfar-range":
            Input.Range_Sensitivity = val;
            Input.Doppler_Sensitivity = null;
            var dbval;
            if(ConfigData.sdkVersionUint16 < 0x0302)
            {            
                dbval = dynamicInput.convertSensitivitydBToLinear(val, ConfigData.platform, ConfigData.Num_Virt_Ant, ConfigData.sdkVersionUint16);
            }
            else
            {
                /*threshold in dB*/
                dbval = val;
            }            
            var linearVal =[];
            var peakVal = [];
            
            ConfigData.cmdLines.forEach(function(item, index) {
                var splitVal = item.split(' ');
                if (splitVal[0] == "cfarCfg" && splitVal[2]=='0') {
                    peakVal.push(splitVal[splitVal.length - 1]);
                    var lastIndex = item.substr(0, item.lastIndexOf(" "));
                    linearVal.push(item.substr(0, lastIndex.lastIndexOf(" ")));
                }
            });
            
            cmd = linearVal[linearVal.length-1] +" "+ dbval +" "+ peakVal[linearVal.length-1];
            break;
            
        case "cfar-doppler":
            Input.Range_Sensitivity = null;
            Input.Doppler_FFT_size = Params.dataPath[0].numDopplerBins;
            Input.Doppler_Sensitivity = val;
            var dbval;
            
            if(ConfigData.sdkVersionUint16 < 0x0302)
            {            
                dbval = dynamicInput.convertSensitivitydBToLinear(val, ConfigData.platform, ConfigData.Num_Virt_Ant, ConfigData.sdkVersionUint16);
            }
            else
            {
                /*threshold in dB*/
                dbval = val;
            }            

            
            var linearVal = [];
            var peakVal = [];
            ConfigData.cmdLines.forEach(function (item, index) {
                var splitVal = item.split(' ');
                if (splitVal[0] =="cfarCfg" && splitVal[2] =='1' ) {
                    peakVal.push(splitVal[splitVal.length - 1]);
                    var lastIndex = item.substr(0, item.lastIndexOf(" "));
                    linearVal.push(item.substr(0, lastIndex.lastIndexOf(" "))); 
                }

            });
            
            cmd = linearVal[linearVal.length-1] +" "+ dbval +" "+ peakVal[linearVal.length-1];
            break;
            
        case "clutter-removal":
            var P = {
                lines: []
            }
            P.clutterRemoval = {};
            dynamicInput.generate_clutterCfgDynamic(Input, P);
            cmd = P.lines[0];
            break;
            
        case "peak-grouping":
            Input.Range_FFT_size = Params.dataPath[0].numRangeBins;
            var peakVals = [];
            var tmpCmd = '';
            
            ConfigData.cmdLines.forEach(function (item, index) {
                peakVals = item.split(" ");
                if (peakVals[0] =="cfarCfg"){
                    if (peakVals[2] == '0' && val == 'range') {
                        peakVals[peakVals.length - 1] = templateObj.$.ti_widget_checkbox_grouppeak_rangedir.checked ? "1" : "0";
                        tempCmd = peakVals.join(' ');
                    } else if (peakVals[2] == '1' && val == 'doppler') {
                        peakVals[peakVals.length - 1] = templateObj.$.ti_widget_checkbox_grouppeak_dopplerdir.checked ? "1" : "0";
                        tempCmd = peakVals.join(' ');
                    }

                }
            });
            
            if (val == 'range' || val == 'doppler') {
                cmd = tempCmd;
            }
            break;
            
            // Edit textboxes and Send FOV commands from Real Time Tunning window starts here
        case "azimuth":
            var azimuth_min = templateObj.$.ti_widget_textbox_azimuth_min.value;
            var azimuth_max = templateObj.$.ti_widget_textbox_azimuth_max.value;
            var elevation_min = templateObj.$.ti_widget_textbox_elevation_min.value;
            var elevation_max = templateObj.$.ti_widget_textbox_elevation_max.value;
            var splitedValue = [];
            ConfigData.cmdLines.forEach(function(item, index) {
                 var trimmedItem = item.split(" ")
                if (trimmedItem[0] == "aoaFovCfg")  {
                   splitedValue = trimmedItem;
                }
            });

            var cmd = [splitedValue[0], splitedValue[1], azimuth_min, azimuth_max, elevation_min, elevation_max].join(" ");
            var trimmedItem = cmd.replace(/ {1,}/g," ");
            cmd = trimmedItem.trim();
            var isValid = validationsCfg.validateCfg([cmd], ConfigData.platform, ConfigData.sdkVersionUint16, Params, false, true);
            if (!isValid) {
                validCmd = false;
            } else {
                cmd = cmd;
            }

            break;
            
        case "rangefov":
            var splitedValue = [];
            cfarFovCfgCmds.forEach(function(item, index) {
                var cfarValues = item.split(" ");
                if(cfarValues[0]=="cfarFovCfg"){
                if (cfarValues[2] == 0)
                    splitedValue = cfarValues;
                }
            });
  
            var range_min = templateObj.$.ti_widget_textbox_range_fov_min.value;
            var range_max = templateObj.$.ti_widget_textbox_range_fov_max.value;
            var cmd = [splitedValue[0], splitedValue[1], splitedValue[2], range_min, range_max].join(" ");
            var trimmedItem = cmd.replace(/ {1,}/g," ");
            cmd = trimmedItem.trim();
            var isValid = validationsCfg.validateCfg([cmd], ConfigData.platform, ConfigData.sdkVersionUint16, Params, false, true);
            if (!isValid) {
                validCmd = false;
            } else {
                cmd = cmd;
            }
            break;
            
            case "dopplerfov":
            var splitedValue = [];
            cfarFovCfgCmds.forEach(function(item, index) {
                var cfarValues = item.split(" ");
                if(cfarValues[0]=="cfarFovCfg"){
                if (cfarValues[2] == 1)
                    splitedValue = cfarValues;
                }
            });

            var doppler_min = templateObj.$.ti_widget_textbox_doppler_fov_min.value;
            var doppler_max = templateObj.$.ti_widget_textbox_doppler_fov_max.value;
            var cmd = [splitedValue[0], splitedValue[1], splitedValue[2], doppler_min, doppler_max].join(" ");
            var trimmedItem = cmd.replace(/ {1,}/g," ");
            cmd = trimmedItem.trim();
            var isValid = validationsCfg.validateCfg([cmd], ConfigData.platform, ConfigData.sdkVersionUint16, Params, false, true);
            if (!isValid) {
                validCmd = false;
            } else {
                cmd = cmd;
            }

            break;
    }


    if (validCmd) 
    {
        cmd_sender_listener.setCfg([cmd], true, false, function (error) {
            if (error) {
                templateObj.$.ti_widget_label_realtimetuning_error_message.visible = true;
                templateObj.$.ti_widget_label_realtimetuning_error_message.fontColor = "#ff0000";
                templateObj.$.ti_widget_label_realtimetuning_error_message.label = "Error: Incorrect "+inputChange+" value  reported by target.";
                templateObj.$.ti_widget_label_realtimetuning_error_message.visible = true;
                
            } else {
                for (var i = 0; i < cmdlist.length; i++) {
                    if (cmd.indexOf(cmdlist[i]) > -1) {

                        for (var j = 0; j < ConfigData.cmdLines.length; j++) {
                            if (ConfigData.cmdLines[j].indexOf(cmdlist[i]) > -1) {
                                if (ConfigData.cmdLines[j].indexOf("cfarCfg") > -1) {
                                    //To update the latest cfarCfg values(range,doppler) in ConfigData.lines
                                    if (ConfigData.cmdLines[j].substring(0, 12) == cmd.substring(0, 12)) {
                                        ConfigData.cmdLines[j] = cmd;
                                    }
                                } 
                                else if (ConfigData.cmdLines[j].indexOf("cfarFovCfg") > -1) {
                                    if (ConfigData.cmdLines[j].substring(0, 15) == cmd.substring(0, 15)) {
                                        ConfigData.cmdLines[j] = cmd;
                                    }
                                } 
                                else {
                                    ConfigData.cmdLines[j] = cmd;
                                }
                            }
                        }
                        break;
                    }
                }
            }
        });
    }
}

// Reset Full Fov  values
function resetFovCmds(type) {
    if (type == 'range') {
        var rangeMeters_Input = 300 * 0.8 * Params.profileCfg[0].digOutSampleRate /
            (2 * Params.profileCfg[0].freqSlopeConst_actual * 1e3);
        rangeMin = 0;
        rangeMax = parseFloat(Math.floor(rangeMeters_Input * 100) / 100).toFixed(2);
        templateObj.$.ti_widget_textbox_range_fov_min.value = rangeMin;
        templateObj.$.ti_widget_textbox_range_fov_max.value = rangeMax;
        clearErrorMessages();

    } else if (type == 'doppler') {
        var numTxAntVal;
        if(Params.platform != mmwInput.Platform.xWR68xx_AOP)
        {        
            numTxAntVal = Params.channelCfg.numTxAzimAnt + Params.channelCfg.numTxElevAnt;
        }
        else 
        {        
            numTxAntVal = Params.dataPath[0].numTxAnt;
        }
               
        var dopplerMps_Input = 3e8 / (4 * Params.profileCfg[0].startFreq_actual * 1e9 *
            (Params.profileCfg[0].idleTime + Params.profileCfg[0].rampEndTime) *
            1e-6 * numTxAntVal);
        dopplerMps_Input = parseFloat(Math.floor(dopplerMps_Input * 100) / 100).toFixed(2);
        templateObj.$.ti_widget_textbox_doppler_fov_min.value = -dopplerMps_Input;
        templateObj.$.ti_widget_textbox_doppler_fov_max.value = dopplerMps_Input;
        clearErrorMessages();
    } else if (type == 'angle') {

        templateObj.$.ti_widget_textbox_azimuth_min.value = -90;
        templateObj.$.ti_widget_textbox_azimuth_max.value = 90;
        templateObj.$.ti_widget_textbox_elevation_min.value = -90;
        templateObj.$.ti_widget_textbox_elevation_max.value = 90;
        clearErrorMessages();


    }

}

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

// 
// usage:
// var tmp = new mmWaveInput();
// tmp.updateInput(); tmp.generateCfg();

// Code structure question:
// do we want to make this code purely no GUI (i.e. no read/change to gui widget values)
// so that it is easier to do auto unit testing
// and potentially for code re-use in other cases?

(function () {
    //'use strict';

    function mmWaveInput() {
        if (!(this instanceof mmWaveInput))
            return new mmWaveInput();

        this.init();
    }

    //mmWaveInput.prototype = { };

    var Platform = {
          xWR16xx: 'xWR16xx'
        , xWR18xx: 'xWR18xx'
        , xWR64xx: 'xWR64xx'
        , xWR68xx: 'xWR68xx'
        , xWR68xx_AOP: 'xWR68xx_AOP'
        , xWR18xx_AOP: 'xWR18xx_AOP'          
    };
    function init() {
        this.Input = {
            lightSpeed: 300 // speed of light m/us
            , kB: 1.38064852e-23 // Bolzmann constant J/K, kgm^2/s^2K
            , cube_4pi: Math.pow(4 * Math.PI, 3)
            , sdkVersionUint16: 0x0306 //careful : hex coding or you can express as (major << 8) | (minor)
            , T0_C: 20 // Ambient temperature, Celcius
            , T0_K: 293.15 // Ambient temperature, Kelvin
        };
    }

    var isRR = function (Input) {
        return Input.subprofile_type == 'best_range_res';
    };
    var isVR = function (Input) {
        return Input.subprofile_type == 'best_vel_res';
    };
    var isBestRange = function (Input) {
        return Input.subprofile_type == 'best_range';
    };

    var convertSensitivityLinearTodB = function (linear_value, platform, Num_Virt_Ant, sdkVersion) {
        var dB_value;        
                
        if( sdkVersion >= 0x0302)
        {
            dB_value = (6 / 256) * (Math.pow(2,Math.ceil(Math.log2(Num_Virt_Ant))) / Num_Virt_Ant) * linear_value ;
        }
        else
        {
            dB_value = (6 / 512) * (Math.pow(2,Math.ceil(Math.log2(Num_Virt_Ant))) / Num_Virt_Ant) * linear_value ;
        }    
        
        return Math.ceil(dB_value);
    };

    
    var convertSensitivitydBToLinear = function (dB_value, platform, Num_Virt_Ant, sdkVersion) {
        var linear_value;
        
        if( sdkVersion >= 0x0302)
        {
            linear_value = (256 / 6) * (Num_Virt_Ant / Math.pow(2,Math.ceil(Math.log2(Num_Virt_Ant)))) * dB_value ;
        }
        else
        {
            linear_value = (512 / 6) * (Num_Virt_Ant / Math.pow(2,Math.ceil(Math.log2(Num_Virt_Ant)))) * dB_value ;
        }    

        return Math.ceil(linear_value);
    };

    var setDefaultRangeResConfig = function (Input) {
        if (!Input.platform) Input.platform = Platform.xWR18xx_AOP;
        Input.subprofile_type = 'best_range_res';
        
        if ((Input.platform == Platform.xWR64xx)||
            (Input.platform == Platform.xWR68xx)||
            (Input.platform == Platform.xWR68xx_AOP))
        {
            Input.Frequency_band = 60;
        }
        else        
        {
            Input.Frequency_band = 77;
        }

        Input.saveRestore = 'None';
        Input.flashOffset = '0x1F0000';
        Input.Frame_Rate = 10;
        Input.Number_of_RX = 4;
        
        if(Input.platform == Platform.xWR68xx_AOP)
        {
            Input.Azimuth_Resolution = '30 + 30';
            Input.Number_of_TX = 3;
        }
        else if(Input.platform == Platform.xWR18xx_AOP)
        {
            Input.Azimuth_Resolution = '30 + 38';
            Input.Number_of_TX = 3;
        }        
        else
        {
            Input.Azimuth_Resolution = '15';
            Input.Number_of_TX = 2;
        }
        
        Input.Doppler_FFT_size = 16; 
        Input.Number_of_chirps = Input.Doppler_FFT_size * Input.Number_of_TX;
        Input.Ramp_Slope = 70;
        Input.Num_ADC_Samples = 256;
        Input.Maximum_range = 9.02; //corresponds to 256 Samples
        Input.Maximum_radial_velocity = 1;

        // hack
        Input.RCS_desired = 0.5;
        var defaultLinearVal;
        if(Input.sdkVersionUint16 >= 0x0302)
        {
            //Sensitivity is given in dB
            Input.Range_Sensitivity = 15;
            Input.Doppler_Sensitivity = 15;
        }
        else
        {
            defaultLinearVal = 1200;
            Input.Range_Sensitivity = convertSensitivityLinearTodB(defaultLinearVal, Input.platform, Input.Number_of_TX * Input.Number_of_RX, Input.sdkVersionUint16);
            Input.Doppler_Sensitivity = convertSensitivityLinearTodB(defaultLinearVal, Input.platform, Input.Number_of_TX * Input.Number_of_RX, Input.sdkVersionUint16); 
        }        
        
    };

    var setDefaultVelResConfig = function (Input) {
        if (!Input.platform) Input.platform = Platform.xWR18xx_AOP;
        Input.subprofile_type = 'best_vel_res';
        
        if ((Input.platform == Platform.xWR64xx)||
            (Input.platform == Platform.xWR68xx)||
            (Input.platform == Platform.xWR68xx_AOP))
        {
            Input.Frequency_band = 60;
        }
        else        
        {
            Input.Frequency_band = 77;
        }
        Input.saveRestore = 'None';
        Input.flashOffset = '0x1F0000';
        Input.Frame_Rate = 10;
        Input.Number_of_RX = 4;
        
        if(Input.platform == Platform.xWR68xx_AOP)
        {
            Input.Azimuth_Resolution = '30 + 30';
            Input.Number_of_TX = 3;
        }
        else if(Input.platform == Platform.xWR18xx_AOP)
        {
            Input.Azimuth_Resolution = '30 + 38';
            Input.Number_of_TX = 3;
        }        
        else
        {
            Input.Azimuth_Resolution = '15';
            Input.Number_of_TX = 2;
        }
        Input.Doppler_FFT_size = 128;
        Input.Number_of_chirps = Input.Doppler_FFT_size * Input.Number_of_TX;
        Input.Bandwidth = 2;
        Input.Num_ADC_Samples = 64;

        // hack
        Input.RCS_desired = 0.5;
        
        var defaultLinearVal;
        if(Input.sdkVersionUint16 >= 0x0302)
        {
            //Sensitivity is given in dB
            Input.Range_Sensitivity = 15;
            Input.Doppler_Sensitivity = 15;
        }
        else
        {
            defaultLinearVal = 1200;
            Input.Range_Sensitivity = convertSensitivityLinearTodB(defaultLinearVal, Input.platform, Input.Number_of_TX * Input.Number_of_RX, Input.sdkVersionUint16);
            Input.Doppler_Sensitivity = convertSensitivityLinearTodB(defaultLinearVal, Input.platform, Input.Number_of_TX * Input.Number_of_RX, Input.sdkVersionUint16);         
        }        

    };

    var setDefaultRangeConfig = function (Input) {
        if (!Input.platform) Input.platform = Platform.xWR18xx_AOP;
        Input.subprofile_type = 'best_range';
        
        if ((Input.platform == Platform.xWR64xx)||
            (Input.platform == Platform.xWR68xx)||
            (Input.platform == Platform.xWR68xx_AOP))
        {
            Input.Frequency_band = 60;
        }
        else        
        {
            Input.Frequency_band = 77;
        }

        Input.saveRestore = 'None';
        Input.flashOffset = '0x1F0000';
        Input.Frame_Rate = 10;
        Input.Number_of_RX = 4;

        if(Input.platform == Platform.xWR68xx_AOP)
        {
            Input.Azimuth_Resolution = '30 + 30';
            Input.Number_of_TX = 3;
        }
        else if(Input.platform == Platform.xWR18xx_AOP)
        {
            Input.Azimuth_Resolution = '30 + 38';
            Input.Number_of_TX = 3;
        }      
        else
        {
            Input.Azimuth_Resolution = '15';
            Input.Number_of_TX = 2;
        }
        Input.Doppler_FFT_size = 16;
        Input.Number_of_chirps = Input.Doppler_FFT_size * Input.Number_of_TX;
        Input.Maximum_range = 50;
        Input.Num_ADC_Samples = 256;
        Input.Maximum_radial_velocity = 1;

        // hack
        Input.RCS_desired = 0.5;
        var defaultLinearVal;
        if(Input.sdkVersionUint16 >= 0x0302)
        {
            //Sensitivity is given in dB
            Input.Range_Sensitivity = 15;
            Input.Doppler_Sensitivity = 15;
        }
        else
        {
            defaultLinearVal = 1200;
            Input.Range_Sensitivity = convertSensitivityLinearTodB(defaultLinearVal, Input.platform, Input.Number_of_TX * Input.Number_of_RX, Input.sdkVersionUint16);
            Input.Doppler_Sensitivity = convertSensitivityLinearTodB(defaultLinearVal, Input.platform, Input.Number_of_TX * Input.Number_of_RX, Input.sdkVersionUint16);         
        }        

    };

    var setSliderRange = function (widget, min, max) {
        // work around slider bug 
        if (max < widget.minValue) {
            widget.minValue = min; widget.maxValue = max;
        } else {
            widget.maxValue = max; widget.minValue = min;
        }
        // workaround for GC-2064
        if (widget.value < widget.minValue) {
            widget.value = widget.minValue;
        }
        if (widget.value > widget.maxValue) {
            widget.value = widget.maxValue;
        }
    };

    var rangeResolutionConstraints1 = function (lightSpeed, total_bw, ramp_slope_lo, ramp_slope_hi, chirp_start_time, chirp_end_time) {
        // for RR
        var range_res_lo = MyUtil.toPrecision(lightSpeed / (2 * (total_bw - ramp_slope_lo * (chirp_start_time + chirp_end_time))), 3);
        var range_res_hi = MyUtil.toPrecision(lightSpeed / (2 * (total_bw - ramp_slope_hi * (chirp_start_time + chirp_end_time))), 3);

        setSliderRange(templateObj.$.ti_widget_slider_range_resolution, ramp_slope_lo, ramp_slope_hi);
        templateObj.$.ti_widget_slider_range_resolution.increment = 5;
        templateObj.$.ti_widget_slider_range_resolution.labels = MyUtil.toLabels([range_res_lo, range_res_hi]);
    };
    var rangeResolutionConstraints2 = function (lightSpeed, Sweep_BW, min_Bandwidth, max_Bandwidth) {
        // for VR
        //var tmp = MyUtil.toPrecision( lightSpeed / ( 2* ( total_bw - ramp_slope * (chirp_start_time + chirp_end_time) ) ), 3);
        var range_res_lo = MyUtil.toPrecision(lightSpeed / (2 * Sweep_BW), 3);
        var range_res_hi = MyUtil.toPrecision(lightSpeed / (2 * Sweep_BW), 3);

        setSliderRange(templateObj.$.ti_widget_slider_range_resolution, min_Bandwidth, max_Bandwidth);
        templateObj.$.ti_widget_slider_range_resolution.increment = 0.5;
        //templateObj.$.ti_widget_slider_range_resolution.labels = MyUtil.toLabels([range_res_lo, range_res_hi]);
        templateObj.$.ti_widget_slider_range_resolution.labels = MyUtil.toLabels(["coarse", "fine"]);
    };
    var rangeResolutionConstraints3 = function (Maximum_range, adc_samples_lo, max_num_adc_samples) {
        // for best range
        var range_res_lo = MyUtil.toPrecision(Maximum_range / (0.8 * max_num_adc_samples), 3);
        var range_res_hi = MyUtil.toPrecision(Maximum_range / (0.8 * adc_samples_lo), 3);

        if (adc_samples_lo == max_num_adc_samples) {
            max_num_adc_samples = max_num_adc_samples + 1; //hack
        }

        setSliderRange(templateObj.$.ti_widget_slider_range_resolution, adc_samples_lo, max_num_adc_samples);
        templateObj.$.ti_widget_slider_range_resolution.increment = 16;
        templateObj.$.ti_widget_slider_range_resolution.labels = MyUtil.toLabels([range_res_hi, range_res_lo]);
    };
    var maxRangeConstraints1 = function (max_range_lo, max_range_hi, inc) {
        // for RR, best range
        if (max_range_lo + inc > max_range_hi) {
            max_range_hi = max_range_lo;
        }

        templateObj.$.ti_widget_slider_max_range.labels = MyUtil.toLabels([max_range_lo, max_range_hi]);
        setSliderRange(templateObj.$.ti_widget_slider_max_range, max_range_lo, max_range_hi);
        templateObj.$.ti_widget_slider_max_range.increment = inc;
    };
    var maxRangeConstraints2 = function (max_range_lo, max_range_hi, adc_samples_lo, max_num_adc_samples) {
        // for VR
        //templateObj.$.ti_widget_slider_max_range.labels = MyUtil.toLabels([max_range_lo, max_range_hi]);
        setSliderRange(templateObj.$.ti_widget_slider_max_range, adc_samples_lo, max_num_adc_samples);
        templateObj.$.ti_widget_slider_max_range.increment = 16;
        templateObj.$.ti_widget_slider_max_range.labels = MyUtil.toLabels(["min", "max"]);
    };
    var radialVelocityConstraints1 = function (max_radial_vel_lo, max_radial_vel_hi, inc) {
        // for RR, best range
        templateObj.$.ti_widget_slider_max_radial_vel.labels = MyUtil.toLabels([max_radial_vel_lo, max_radial_vel_hi]);
        setSliderRange(templateObj.$.ti_widget_slider_max_radial_vel, max_radial_vel_lo, max_radial_vel_hi);
        templateObj.$.ti_widget_slider_max_radial_vel.increment = inc;
    };
    var radialVelocityConstraints2 = function (max_radial_vel_lo, max_radial_vel_hi, N_fft2d_lo, N_fft2d_hi) {
        // for VR
        var lo = Math.log2(N_fft2d_lo);
        var hi = Math.log2(N_fft2d_hi);
        templateObj.$.ti_widget_slider_max_radial_vel.labels = MyUtil.toLabels([max_radial_vel_lo, max_radial_vel_hi]);
        setSliderRange(templateObj.$.ti_widget_slider_max_radial_vel, lo, hi);
        templateObj.$.ti_widget_slider_max_radial_vel.increment = 1;
    };

    var velocityResolutionConstraints1 = function (max_number_of_chirps, Number_of_TX, N_fft2d_lo, Maximum_radial_velocity, Doppler_FFT_size) {
        // for RR, best range
        var radial_vel_res_values = [];
        var radial_vel_res_labels = [];
        for (var tmp = max_number_of_chirps / Number_of_TX; tmp >= N_fft2d_lo; tmp = tmp >> 1) {
            radial_vel_res_values.push(tmp);
            radial_vel_res_labels.push(MyUtil.toCeil(Maximum_radial_velocity / (tmp / 2), 2));
        }
        templateObj.$.ti_widget_droplist_radial_vel_resolution.disabled = false;
        templateObj.$.ti_widget_droplist_radial_vel_resolution.values = radial_vel_res_values.join('|');
        templateObj.$.ti_widget_droplist_radial_vel_resolution.labels = radial_vel_res_labels.join('|');

        // hack
        var value = parseInt(templateObj.$.ti_widget_droplist_radial_vel_resolution.selectedValue, 10);
        if (isNaN(value) === true) value = Doppler_FFT_size;
        var idx = radial_vel_res_values.indexOf(value);
        if (idx >= 0) {
            if (templateObj.$.ti_widget_droplist_radial_vel_resolution.selectedValue != radial_vel_res_values[idx])
                templateObj.$.ti_widget_droplist_radial_vel_resolution.selectedValue = radial_vel_res_values[idx];
        } else {
            templateObj.$.ti_widget_droplist_radial_vel_resolution.selectedValue = radial_vel_res_values.length > 0 ? radial_vel_res_values[0] : undefined;
        }
    };

    var velocityResolutionConstraints2 = function (radial_velocity_resolution) {
        // for VR
        templateObj.$.ti_widget_droplist_radial_vel_resolution.disabled = true;
        templateObj.$.ti_widget_droplist_radial_vel_resolution.labels = radial_velocity_resolution.toString();
        templateObj.$.ti_widget_droplist_radial_vel_resolution.selectedIndex = 0;
    };

    var updateInput = function (changes) {
        var Input = this.Input;
        for (var k in changes) {
            if (changes.hasOwnProperty(k)) {
                Input[k] = changes[k];
            }
        }
        
        var defaultLinearVal;
        if(Input.sdkVersionUint16 >= 0x0302)
        {
            defaultLinearVal = 640;
        }
        else
        {
            defaultLinearVal = 1200;
        }        

        if (Input.platform == Platform.xWR16xx) {
            Input.L3_Memory_size = 640;
            Input.ADCBuf_memory_size = 32768;
            Input.CFAR_memory_size = 0;     //Bytes - NA
            Input.CFAR_window_memory_size = 1024; //words - 32-bits - NA
            Input.Max_Sampling_Rate = 6.25;
            Input.Min_Sampling_rate = 2; //Msps
            if (!Input.Num_Virt_Ant) Input.Num_Virt_Ant = 8;
            if (!Input.Range_Sensitivity) Input.Range_Sensitivity = convertSensitivityLinearTodB(640, Input.platform, Input.Num_Virt_Ant, Input.sdkVersionUint16);
            if (!Input.Doppler_Sensitivity) Input.Doppler_Sensitivity = convertSensitivityLinearTodB(640, Input.platform, Input.Num_Virt_Ant, Input.sdkVersionUint16);
            Input.max_number_of_rx = 4;
            Input.max_number_of_tx = 2;
        }else if (Input.platform == Platform.xWR18xx) {
            Input.L3_Memory_size = 1024;
            Input.ADCBuf_memory_size = 16384;
            Input.CFAR_memory_size = 32768;
            Input.CFAR_window_memory_size = 1024; 
            Input.Max_Sampling_Rate = 12.5;
            Input.Min_Sampling_rate = 2; //Msps
            if (!Input.Num_Virt_Ant) Input.Num_Virt_Ant = 8;
            if (!Input.Range_Sensitivity) Input.Range_Sensitivity = convertSensitivityLinearTodB(defaultLinearVal, Input.platform , Input.Num_Virt_Ant, Input.sdkVersionUint16);
            if (!Input.Doppler_Sensitivity) Input.Doppler_Sensitivity = convertSensitivityLinearTodB(defaultLinearVal, Input.platform, Input.Num_Virt_Ant, Input.sdkVersionUint16);
            Input.max_number_of_rx = 4;
            Input.max_number_of_tx = 3;
        }
        else if (Input.platform == Platform.xWR18xx_AOP) {
            Input.L3_Memory_size = 1024;
            Input.ADCBuf_memory_size = 16384;
            Input.CFAR_memory_size = 32768;
            Input.CFAR_window_memory_size = 1024; 
            Input.Max_Sampling_Rate = 12.5;
            Input.Min_Sampling_rate = 2; //Msps
            if (!Input.Num_Virt_Ant) Input.Num_Virt_Ant = 8;  /* TODO */
            if (!Input.Range_Sensitivity) Input.Range_Sensitivity = convertSensitivityLinearTodB(defaultLinearVal, Input.platform , Input.Num_Virt_Ant, Input.sdkVersionUint16);
            if (!Input.Doppler_Sensitivity) Input.Doppler_Sensitivity = convertSensitivityLinearTodB(defaultLinearVal, Input.platform, Input.Num_Virt_Ant, Input.sdkVersionUint16);
            Input.max_number_of_rx = 4;
            Input.max_number_of_tx = 3;
        }else if (Input.platform == Platform.xWR68xx) {
            Input.L3_Memory_size = 768;
            Input.ADCBuf_memory_size = 16384;
            Input.CFAR_memory_size = 32768;     //Bytes
            Input.CFAR_window_memory_size = 1024; //words - 32-bits
            Input.Max_Sampling_Rate = 12.5;
            Input.Min_Sampling_rate = 2; //Msps
            if (!Input.Num_Virt_Ant) Input.Num_Virt_Ant = 8;
            if (!Input.Range_Sensitivity) Input.Range_Sensitivity = convertSensitivityLinearTodB(defaultLinearVal, Input.platform, Input.Num_Virt_Ant, Input.sdkVersionUint16);
            if (!Input.Doppler_Sensitivity) Input.Doppler_Sensitivity = convertSensitivityLinearTodB(defaultLinearVal, Input.platform, Input.Num_Virt_Ant, Input.sdkVersionUint16);
            Input.max_number_of_rx = 4;
            Input.max_number_of_tx = 3;
        }else if (Input.platform == Platform.xWR64xx) {
            Input.L3_Memory_size = 768;
            Input.ADCBuf_memory_size = 16384;
            Input.CFAR_memory_size = 32768;     //Bytes
            Input.CFAR_window_memory_size = 1024; //words - 32-bits
            Input.Max_Sampling_Rate = 12.5;
            Input.Min_Sampling_rate = 2; //Msps
            if (!Input.Num_Virt_Ant) Input.Num_Virt_Ant = 8;
            if (!Input.Range_Sensitivity) Input.Range_Sensitivity = convertSensitivityLinearTodB(640, Input.platform, Input.Num_Virt_Ant, Input.sdkVersionUint16);
            if (!Input.Doppler_Sensitivity) Input.Doppler_Sensitivity = convertSensitivityLinearTodB(640, Input.platform, Input.Num_Virt_Ant, Input.sdkVersionUint16);
            Input.max_number_of_rx = 4;
            Input.max_number_of_tx = 3;
        }else if (Input.platform == Platform.xWR68xx_AOP) {
            Input.L3_Memory_size = 768;
            Input.ADCBuf_memory_size = 16384;
            Input.CFAR_memory_size = 32768;     //Bytes
            Input.CFAR_window_memory_size = 1024; //words - 32-bits
            Input.Max_Sampling_Rate = 12.5;
            Input.Min_Sampling_rate = 2; //Msps
            if (!Input.Num_Virt_Ant) Input.Num_Virt_Ant = 12;
            if (!Input.Range_Sensitivity) Input.Range_Sensitivity = convertSensitivityLinearTodB(640, Input.platform, Input.Num_Virt_Ant, Input.sdkVersionUint16);
            if (!Input.Doppler_Sensitivity) Input.Doppler_Sensitivity = convertSensitivityLinearTodB(640, Input.platform, Input.Num_Virt_Ant, Input.sdkVersionUint16);
            Input.max_number_of_rx = 4;
            Input.max_number_of_tx = 3;
        }

        //Input.Azimuth_Resolution;
        if(Input.platform == Platform.xWR68xx_AOP)
        {
            /* AOP antenna pattern has a unique set of resolution*/
            if (Input.Azimuth_Resolution == '30 + 30') 
            {
                Input.Number_of_RX = 4;
                Input.Number_of_TX = 3;
            } 
            else if ((Input.Azimuth_Resolution == '60 + 30') ||
                     (Input.Azimuth_Resolution == 'Diagonal') ||
                     (Input.Azimuth_Resolution == '30 + 60'))                     
            {
                Input.Number_of_RX = 4;
                Input.Number_of_TX = 2;
            } 
            else if (Input.Azimuth_Resolution == '60 + 60') 
            {
                Input.Number_of_RX = 4;
                Input.Number_of_TX = 1;
            } 
        }
        else if(Input.platform == Platform.xWR18xx_AOP)
        {
            /* AOP antenna pattern has a unique set of resolution */
            if (Input.Azimuth_Resolution == '30 + 38')
            {
                Input.Number_of_RX = 4;
                Input.Number_of_TX = 3;
            } 
            else if (Input.Azimuth_Resolution == '30 + 60')
            {
                Input.Number_of_RX = 4;
                Input.Number_of_TX = 2;
            } 
        }
        else
        {
            if (Input.Azimuth_Resolution == '15 + Elevation') 
            {
                Input.Number_of_RX = 4;
                Input.Number_of_TX = 3;
                if (Input.platform == Platform.xWR16xx) 
                {
                    Input.Number_of_RX = 4;
                    Input.Number_of_TX = 2;
                }
            } 
            else if (Input.Azimuth_Resolution == '15') 
            {
                Input.Number_of_RX = 4;
                Input.Number_of_TX = 2;
            } 
            else if (Input.Azimuth_Resolution == '30') 
            {
                Input.Number_of_RX = 4;
                Input.Number_of_TX = 1;
            } 
            else if (Input.Azimuth_Resolution == '60') 
            {
                Input.Number_of_RX = 2;
                Input.Number_of_TX = 1;
            } 
            else if (Input.Azimuth_Resolution == 'None (1Rx/1Tx)') 
            {
                Input.Number_of_RX = 1;
                Input.Number_of_TX = 1;
            }           
        }
        Input.Num_Virt_Ant = Input.Number_of_RX * Input.Number_of_TX;

        Input.ADC_bits = 16;
        Input.ADC_samples_type = 2; // 1-real, 2-complex

        //Input.Bandwidth;
        Input.Bandwidth_list = [0.5, 1, 1, 5, 2, 2.5, 3, 3.5, 4]; // GHz
        Input.Min_Allowable_Bandwidth = 0.5; // GHz

        Input.Chirp_end_guard_time = 1;

        //Set chirps per interrupt to 0 (maximize chirps) for xwr16xx    
        if (Input.platform == Platform.xWR16xx) 
        {
            Input.chirps_per_interrupt = 0; //max possible
        }
        else 
        {
            //HWA does not handle multi-chirp. If 1D FFT is done by HWA, the respective demo should be here.
            Input.chirps_per_interrupt = 1;
        }

        Input.Chirp_Start_Time = 7;
        Input.Min_Interchirp_dur = 8;

        Input.Doppler_FFT_list = [16, 32, 64, 128, 256];
        var N_fft2d_lo = Input.Doppler_FFT_list[0];
        var adc_samples_lo = 64; // radar FE expects this as minimum value
        //Input.Doppler_Sensitivity = 5000;
        //Input.Frame_Rate;
        //Input.Frequency_band;

        Input.Max_Slope = 100;
        Input.Maximum_range_list = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]; // Range sheet

        Input.Gr = 8;
        Input.Gt = 8;
        Input.Ld = 2;
        Input.Lim = 2;
        
        //See Figure 1(a) in https://radarsp.weebly.com/uploads/2/1/4/7/21471216/notes_on_noncoherent_integration_gain.pdf
        if (Input.Num_Virt_Ant == 12) Input.Lncoh = 3;          //Gnc/N=0.5
        else if (Input.Num_Virt_Ant == 8) Input.Lncoh = 2.2;    //Gnc/N=0.6
        else if (Input.Num_Virt_Ant == 4) Input.Lncoh = 1.5;    //Gnc/N=0.7
        else if (Input.Num_Virt_Ant == 2) Input.Lncoh = 0.7;    //Gnc/N=0.85
        else if (Input.Num_Virt_Ant == 1) Input.Lncoh = 0;
        //for anything more than 12 Virt Antennas, assume Gnc/N=0.25, which leads to loss of 6 dB. 
        //This is just a catch all condition. 
        // Any known virt antenna value should be added as a separate if statement above
        else Input.Lncoh = 6;         
        
        Input.Ls = 1;
        if ((Input.platform == Platform.xWR64xx)||
            (Input.platform == Platform.xWR68xx)||
            (Input.platform == Platform.xWR68xx_AOP))
        {
            Input.NF = 15;//TODO
        }
        else
        {
            Input.NF = Input.Frequency_band == 77 ? 16 : 15;
        }
              
        Input.Pt = 12;
        Input.SNR_det = 12;
        Input.loss_dB = Input.Pt + Input.Gt + Input.Gr - Input.Lncoh - Input.Ld - Input.Ls - Input.Lim - Input.SNR_det - Input.NF;
        Input.loss_linear = Math.pow(10, Input.loss_dB / 10);

        if ((Input.platform == Platform.xWR64xx)||
            (Input.platform == Platform.xWR68xx)||
            (Input.platform == Platform.xWR68xx_AOP))
        {
            Input.Max_Allowable_Bandwidth = 4;// GHz
        }
        else
        {
            Input.Max_Allowable_Bandwidth = Input.Frequency_band == 77 ? 4 : 1;// GHz
        }    
        
        Input.Total_BW;
        var tmp = isRR(Input);
        if (Input.subprofile_type == 'best_range_res') {
            if (Input.Frequency_band == 77) {
                Input.Bandwidth = 4;
            } else if (Input.Frequency_band == 76) {
                Input.Bandwidth = 1;
            } else if (Input.Frequency_band == 60) {
                Input.Bandwidth = 4;
            }
            
            Input.Total_BW = Input.Bandwidth * 1000;
            Input.min_Ramp_Slope = 20;
            if (!Input.Ramp_Slope) Input.Ramp_Slope = Input.min_Ramp_Slope; //preset
            if (!Input.Number_of_chirps) Input.Number_of_chirps = 16;//preset
            Input.Max_Slope = Math.min(Input.Max_Slope,
                Math.floor((Input.Max_Allowable_Bandwidth * 1000 * Input.Max_Sampling_Rate) /
                    (adc_samples_lo + Input.Max_Sampling_Rate * (Input.Chirp_Start_Time + Input.Chirp_end_guard_time))));
            Input.Max_Slope = Math.floor(Input.Max_Slope / 5) * 5;
            rangeResolutionConstraints1(Input.lightSpeed, Input.Total_BW, Input.min_Ramp_Slope, Input.Max_Slope, Input.Chirp_Start_Time, Input.Chirp_end_guard_time);
        } else if (Input.subprofile_type == 'best_vel_res') {
            if (!Input.Bandwidth) Input.Bandwidth = 0.5;//preset
            if (!Input.Num_ADC_Samples) Input.Num_ADC_Samples = adc_samples_lo;
            if (!Input.Doppler_FFT_size) Input.Doppler_FFT_size = N_fft2d_lo;
            Input.Total_BW = Input.Bandwidth * 1000;
        } else if (Input.subprofile_type == 'best_range') {
            if (!Input.Number_of_chirps) Input.Number_of_chirps = 16;//preset
        }

        Input.Frame_duration = MyUtil.toPrecision(1000 / Input.Frame_Rate, 3);
        var max_Ramp_Slope1 = Math.floor(Input.Bandwidth * 1000 / ((32 / Input.Max_Sampling_Rate) + Input.Chirp_Start_Time + Input.Chirp_end_guard_time));
        Input.max_Ramp_Slope = Math.max(Math.min(Input.Max_Slope, max_Ramp_Slope1), 5);

        if (Input.subprofile_type == 'best_vel_res') {
            Input.Radial_velocity_Resolution = MyUtil.toCeil(Input.lightSpeed / (Input.Frequency_band * Input.Frame_duration), 2); // VR sheet
            Input.Maximum_radial_velocity = MyUtil.toPrecision(Input.Radial_velocity_Resolution * Input.Doppler_FFT_size / 2, 2);// VR sheet
            Input.Number_of_chirps = Input.Doppler_FFT_size * Input.Number_of_TX;//VR
            Input.min_Ramp_Slope = Math.min(MyUtil.toPrecision(Input.Bandwidth * 1000 / ((Input.Frame_duration * 1000 / (2 * Input.Number_of_chirps)) - Input.Min_Interchirp_dur), 3), Input.max_Ramp_Slope);
            Input.Ramp_Slope = Math.max(Math.min(MyUtil.toPrecision(Input.Bandwidth * 1000 / (Input.Chirp_end_guard_time + Input.Chirp_Start_Time +
                Input.Num_ADC_Samples / Input.Max_Sampling_Rate), 3), Input.Max_Slope), Input.min_Ramp_Slope); // VR sheet
        } else if (Input.subprofile_type == 'best_range') {
            Input.Range_Resolution = MyUtil.toPrecision(Input.Maximum_range / (0.8 * Input.Num_ADC_Samples), 3); // Range Sheet
            Input.Sweep_BW = MyUtil.toPrecision(Input.lightSpeed / (2 * Input.Range_Resolution), 3); // Range Sheet

            var ramp_slope1 = MyUtil.toPrecision(Input.lightSpeed * 0.8 * Input.Max_Sampling_Rate / (2 * Input.Maximum_range), 3);
            var ramp_slope2 = MyUtil.toCeil((Input.Max_Allowable_Bandwidth * 1000 - (Input.lightSpeed * 0.8 * Input.Num_ADC_Samples / (2 * Input.Maximum_range))) / (Input.Chirp_Start_Time + Input.Chirp_end_guard_time), 3);
            if (ramp_slope2 <= 0) {
                ramp_slope2 = ramp_slope1;
            }
            Input.Ramp_Slope = MyUtil.min([ramp_slope1, ramp_slope2, Input.Max_Slope]); // Range Sheet
        }

        if (Input.subprofile_type != 'best_range') {
            Input.Chirp_duration = MyUtil.toPrecision(Input.Total_BW / Input.Ramp_Slope, 2);//RR,VR
            Input.ADC_Collection_Time = MyUtil.toPrecision(Input.Chirp_duration - Input.Chirp_Start_Time - Input.Chirp_end_guard_time, 2);//RR,VR
            Input.Sweep_BW = MyUtil.toPrecision(Input.ADC_Collection_Time * Input.Ramp_Slope, 3);
            Input.Range_Resolution = MyUtil.toPrecision(Input.lightSpeed / (2 * (Input.Sweep_BW)), 3);
            Input.ADC_Sampling_Rate = MyUtil.toFloor(Input.Ramp_Slope * Input.Num_ADC_Samples / Input.Sweep_BW, 3); //RR,VR
            Input.Range_FFT_size = 1 << Math.ceil(Math.log2(Input.Num_ADC_Samples)); // TODO hack see below //MMWSDK-580
        } else {
            Input.ADC_Collection_Time = MyUtil.toPrecision(Input.Sweep_BW / Input.Ramp_Slope, 2); // Range Sheet
            Input.Chirp_duration = MyUtil.toPrecision(Input.ADC_Collection_Time + Input.Chirp_end_guard_time + Input.Chirp_Start_Time, 2); // Range Sheet
            Input.ADC_Sampling_Rate = MyUtil.toFloor(2 * Input.Ramp_Slope * Input.Maximum_range / (Input.lightSpeed * 0.8), 3); // Range Sheet
            Input.Total_BW = Input.Chirp_duration * Input.Ramp_Slope; // Range Sheet
            Input.Range_FFT_size = 1 << Math.ceil(Math.log2(Input.Num_ADC_Samples)); // TODO hack see below
        }

        if (Input.subprofile_type != 'best_vel_res') {
            Input.Doppler_FFT_size = Input.Number_of_chirps / Input.Number_of_TX;
        }
        //Input.Doppler_FFT_size = from max radial velocity selection // VR Sheet

        Input.frame_rate_max = 1000000 / ((Input.Total_BW / Input.Ramp_Slope + Input.Min_Interchirp_dur) * Input.Doppler_FFT_size * Input.Number_of_TX * 2);
        Input.frame_rate_min = 1;
        if (Input.subprofile_type != 'best_vel_res') {
            Input.Inter_chirp_duration = Math.floor((Input.lightSpeed * 1000) / (4 * Input.Frequency_band * Input.Maximum_radial_velocity * Input.Number_of_TX) - Input.Chirp_duration);
        } else {
            Input.Inter_chirp_duration = Math.floor((((Input.Frame_duration / 2) / Input.Number_of_chirps) * 1000) - Input.Chirp_duration); // VR sheet
        }
        Input.Frame_time_active = (Input.Chirp_duration + Input.Inter_chirp_duration) * Input.Number_of_chirps / 1000;

        var max_Bandwidth1 = Input.Max_Slope * (Input.Frame_duration * 1000 / (2 * Input.Number_of_TX * Input.Doppler_FFT_size) - Input.Min_Interchirp_dur) / 1000;
        var max_Bandwidth2 = Math.floor(((Input.lightSpeed / (Input.Maximum_radial_velocity * Input.Frame_duration)) + ((Input.Max_Slope * (Input.Chirp_end_guard_time + Input.Chirp_Start_Time)) / 1000)) / 0.5, 1) * 0.5;
        Input.max_Bandwidth = MyUtil.min([Input.Max_Allowable_Bandwidth, max_Bandwidth1, max_Bandwidth2]);

        Input.max_Inter_chirp_dur = 5242.87;

        var max_inter_chirp_duration1 = (((Input.Frame_duration / 2) / Input.Number_of_chirps) * 1000) - Input.Chirp_duration;
        var idleTime_hi = 5242.87;
        Input.max_inter_chirp_duration = MyUtil.toFloor(Math.min(max_inter_chirp_duration1, idleTime_hi), 2);

        var N_fft1d_max1;
        var adc_samples_lo_calc = adc_samples_lo;
        var N_fft1d_max2 = 1 << Math.floor(Math.log2((Input.L3_Memory_size * 1024 / (4 * Input.Number_of_RX * Input.Number_of_TX + 2)) / N_fft2d_lo));//RR,best range
        var N_fft1d_max4 = 4096; //junk - big value
        var N_fft1d_max5 = 4096; //junk - big value
        var N_fft1d_max6 = 4096; //junk - big value
        if ((Input.platform == Platform.xWR18xx)||
            (Input.platform == Platform.xWR64xx)||
            (Input.platform == Platform.xWR68xx_AOP)) 
        {
            N_fft1d_max4 = 1 << Math.floor(Math.log2(Input.CFAR_memory_size / (2 * N_fft2d_lo)));
            N_fft1d_max6 = Input.CFAR_window_memory_size - N_fft2d_lo; //MMWSDK-578
        }
        if (Input.subprofile_type == 'best_range_res') {
            N_fft1d_max1 = Input.Max_Sampling_Rate * Input.Sweep_BW / Input.Ramp_Slope;
            adc_samples_lo_calc = Math.max(adc_samples_lo, Math.ceil(Input.Sweep_BW * Input.Min_Sampling_rate / Input.Ramp_Slope));
            adc_samples_lo_calc = 16 * Math.ceil(adc_samples_lo_calc / 16); //MMWSDK-587
        } else if (Input.subprofile_type == 'best_vel_res') {
            N_fft1d_max1 = (Input.Frame_duration * 1000 / (2 * Input.Number_of_TX * Input.Doppler_FFT_size) -
                Input.Min_Interchirp_dur - Input.Chirp_end_guard_time - Input.Chirp_Start_Time) * Input.Max_Sampling_Rate; // VR sheet
            N_fft1d_max2 = 1 << Math.floor(Math.log2((Input.L3_Memory_size * 1024 / (4 * Input.Number_of_RX + 2 / Input.Number_of_TX)) / Input.Number_of_chirps)); // VR sheet
            if ((Input.platform == Platform.xWR18xx)||            
                (Input.platform == Platform.xWR64xx)||
                (Input.platform == Platform.xWR68xx_AOP))
            {
                N_fft1d_max4 = 1 << Math.floor(Math.log2(Input.CFAR_memory_size * Input.Number_of_TX / (2 * Input.Number_of_chirps)));
                N_fft1d_max6 = Input.CFAR_window_memory_size - (Input.Number_of_chirps / Input.Number_of_TX); //MMWSDK-578
            }
            N_fft1d_max5 = Math.floor(50 / (0.8 * Input.Range_Resolution), 2); //limit to 50m
        } else if (Input.subprofile_type == 'best_range') {
            N_fft1d_max1 = (Input.Max_Allowable_Bandwidth * 1000 - Input.Ramp_Slope * (Input.Chirp_end_guard_time + Input.Chirp_Start_Time))
                * Input.ADC_Sampling_Rate / Input.Ramp_Slope; // Range Sheet
        }
        N_fft1d_max1 = Math.floor(N_fft1d_max1);

        //if chirps per interrupt is set to max allowed, then for limits compute purposes, 
        //need to use 1, else what is intended by user.
        var chirpsPerInt;
        if (Input.chirps_per_interrupt == 0) {
            chirpsPerInt = 1;
        }
        else {
            chirpsPerInt = Input.chirps_per_interrupt;
        }
        var N_fft1d_max3 = Math.floor(Input.ADCBuf_memory_size / (Input.Number_of_RX * chirpsPerInt * Input.ADC_bits / 8 * Input.ADC_samples_type));

        Input.max_num_adc_samples = MyUtil.min([N_fft1d_max1, N_fft1d_max2, N_fft1d_max3, N_fft1d_max4, N_fft1d_max5, N_fft1d_max6]);
        Input.max_num_adc_samples = MyUtil.max([Input.max_num_adc_samples, adc_samples_lo_calc]);

        if (Input.subprofile_type == 'best_vel_res') {
            var max2 = (Input.L3_Memory_size * 1024 / (4 * Input.Number_of_RX + 2 / Input.Number_of_TX)) / adc_samples_lo;
            var max3 = (Input.Frame_duration / 2) * 1000 / (Input.Min_Interchirp_dur + Input.Chirp_Start_Time + Input.Chirp_end_guard_time + (adc_samples_lo / Input.Max_Sampling_Rate));
            var max4 = 4096; //junk - large value
            var max5 = 4096; //junk - large value
            if ((Input.platform == Platform.xWR18xx) ||
                (Input.platform == Platform.xWR64xx) ||
                (Input.platform == Platform.xWR68xx_AOP))
            {
                max4 = Input.CFAR_memory_size * Input.Number_of_TX / (2 * adc_samples_lo);
                max5 = (Input.CFAR_window_memory_size - adc_samples_lo) * Input.Number_of_TX;
            }
            var max6 = 255 * Input.Number_of_TX; // RF front end requirement
            Input.max_number_of_chirps = (1 << Math.floor(Math.log2(MyUtil.min([max2, max3, max4, max5, max6]) / Input.Number_of_TX))) * Input.Number_of_TX;
        } else {
            var chirp_limits = [];
            chirp_limits.push(2 * Input.Frequency_band / (Input.Sweep_BW / 1000) * Input.Number_of_TX);//RR,range,
            chirp_limits.push((Input.L3_Memory_size * 1024 / (4 * Input.Number_of_RX + 2 / Input.Number_of_TX)) / Input.Range_FFT_size);//RR,range
            if ((Input.platform == Platform.xWR18xx)||
                (Input.platform == Platform.xWR64xx)||
                (Input.platform == Platform.xWR68xx_AOP))            
            {
                chirp_limits.push(Input.CFAR_memory_size * Input.Number_of_TX / (2 * Input.Range_FFT_size));//RR,range
                chirp_limits.push((Input.CFAR_window_memory_size - Input.Range_FFT_size) * Input.Number_of_TX);//RR,range
            }
            chirp_limits.push(255 * Input.Number_of_TX); // Rf front end requirement
            if (Input.subprofile_type == 'best_range') {
                chirp_limits.push((Input.Frame_duration * 1000 / 2) / (Input.Inter_chirp_duration + Input.Chirp_duration)); // range
            }
            Input.max_number_of_chirps = (1 << Math.floor(Math.log2(MyUtil.min(chirp_limits) / Input.Number_of_TX))) * Input.Number_of_TX;
        }

        //Input.Maximum_radial_velocity; // directly from widget for RR, best range
        //Input.Maximum_range; // directly from widget for RR, best range
        if (Input.subprofile_type == 'best_vel_res') {
            Input.Maximum_range = MyUtil.toFloor(0.8 * Input.Range_Resolution * Input.Num_ADC_Samples, 2); // VR sheet // Winnie's bug : Note Math.floor() only takes 1 arg. Use MyUtil.toFloor(n, p)
        }


        Input.min_Bandwidth = Input.Min_Allowable_Bandwidth;

        if (Input.subprofile_type == 'best_range_res') {
            // best range: range resolution widget selcts num adc samples directly
            // VR: max range widget selects num add samples directly
            // [ hack
            if (Input.Num_ADC_Samples && !Input.Maximum_range) {
                // logic came here since Max Range value is out of bounds for min/max set in previous call.
                // so num ADC samples cannot be trusted as well.
                if ((Input.Num_ADC_Samples < adc_samples_lo_calc) || (Input.Num_ADC_Samples > Input.max_num_adc_samples)) {
                    Input.Num_ADC_Samples = adc_samples_lo_calc;
                }
                Input.Maximum_range = MyUtil.toFloor(0.8 * Input.Range_Resolution, 2) * Input.Num_ADC_Samples;
            } else { //]
                Input.Num_ADC_Samples = 16 * Math.floor(Input.Maximum_range / (0.8 * Input.Range_Resolution * 16)); // but range sheet: range resolution widget selcts num adc samples directly
            }
            Input.ADC_Sampling_Rate = MyUtil.toFloor(Input.Ramp_Slope * Input.Num_ADC_Samples / Input.Sweep_BW, 3); //RR,VR
            Input.Range_FFT_size = 1 << Math.ceil(Math.log2(Input.Num_ADC_Samples));
        }
        /*
        if (Input.subprofile_type == 'best_vel_res') {// repeat
            Input.Radial_velocity_Resolution = MyUtil.toCeil(Input.lightSpeed/(Input.Frequency_band*Input.Frame_duration), 2); // VR sheet
            Input.Maximum_radial_velocity = MyUtil.toPrecision(Input.Radial_velocity_Resolution*Input.Doppler_FFT_size/2, 2);// VR sheet
            Input.Number_of_chirps = Input.Doppler_FFT_size*Input.Number_of_TX;//VR
            Input.min_Ramp_Slope = Math.min(MyUtil.toPrecision(Input.Bandwidth*1000/((Input.Frame_duration*1000/(2*Input.Number_of_chirps))-Input.Min_Interchirp_dur),3),Input.max_Ramp_Slope);
            Input.Ramp_Slope = Math.max(Math.min(MyUtil.toPrecision(Input.Bandwidth*1000/(Input.Chirp_end_guard_time+Input.Chirp_Start_Time+
                Input.Num_ADC_Samples/Input.Max_Sampling_Rate), 3),Input.Max_Slope),Input.min_Ramp_Slope); // VR sheet
        } else if (Input.subprofile_type == 'best_range') {
            Input.Ramp_Slope = Math.min(Input.lightSpeed*Input.Max_Sampling_Rate/(2*Input.Maximum_range),Input.Max_Slope); // Range Sheet
        }
        */
        Input.Non_sweep_BW = (Input.Chirp_Start_Time + Input.Chirp_end_guard_time) * Input.Ramp_Slope;

        //Input.Range_FFT_size = 1<<Math.ceil(Math.log2(Input.ADC_Sampling_Rate*Input.ADC_Collection_Time)); // TODO hack move up a bit

        if (Input.subprofile_type != 'best_range') {//repeat
            Input.Sweep_BW = Input.ADC_Collection_Time * Input.Ramp_Slope;
            Input.Range_Resolution = MyUtil.toPrecision(Input.lightSpeed / (2 * (Input.Sweep_BW)), 3);
        } else {
            Input.Range_Resolution = MyUtil.toPrecision(Input.Maximum_range / (0.8 * Input.Num_ADC_Samples), 3); // Range Sheet
            Input.Sweep_BW = MyUtil.toPrecision(Input.lightSpeed / (2 * Input.Range_Resolution), 3); // Range Sheet
        }

        Input.Range_high = MyUtil.toFloor(0.8 * Input.Range_Resolution * Input.max_num_adc_samples, 2);
        Input.Range_low = MyUtil.toCeil(0.8 * Input.Range_Resolution * adc_samples_lo_calc, 2);

        if (Input.subprofile_type == 'best_range_res') {
            var RangeIncrements;
            
            if ((Input.platform == Platform.xWR18xx)||
                (Input.platform == Platform.xWR18xx_AOP)||
                (Input.platform == Platform.xWR64xx)||
                (Input.platform == Platform.xWR68xx)||
                (Input.platform == Platform.xWR68xx_AOP)) 
            {
                RangeIncrements = 0.01;
            }
            else if (Input.platform == Platform.xWR16xx) 
            {
                // "16" is due to the limitation on ADC samples in the demo  
                RangeIncrements = MyUtil.toCeil(0.8 * Input.Range_Resolution * 16, 2);
            }
            maxRangeConstraints1(Input.Range_low, Input.Range_high, RangeIncrements);
        } else if (Input.subprofile_type == 'best_vel_res') {
            rangeResolutionConstraints2(Input.lightSpeed, Input.Sweep_BW, Input.min_Bandwidth, Input.max_Bandwidth);
            maxRangeConstraints2(Input.Range_low, Input.Range_high, adc_samples_lo, Input.max_num_adc_samples);
        } else if (Input.subprofile_type == 'best_range') {
            var lo = Input.Maximum_range_list[0];
            if (Input.Frequency_band == 76) {
                lo = Input.Maximum_range_list[1]; // (c*0.8*adc_samples_lo/1Ghz)/2 = 7.68 //MMWSDK-590
            }
            var hi = Input.Maximum_range_list[Input.Maximum_range_list.length - 1];
            var inc = Input.Maximum_range_list[1] - Input.Maximum_range_list[0];
            maxRangeConstraints1(lo, hi, inc);
            rangeResolutionConstraints3(Input.Maximum_range, adc_samples_lo, Input.max_num_adc_samples);
        }

        Input.Wavelength = Input.lightSpeed / Input.Frequency_band;

        //Input.Range_Sensitivity = 5000;
        Input.RCS_des_max = Input.RCS_Rmax;
        //Input.RCS_desired;
        var max_range_exp_4 = Math.pow(Input.Maximum_range, 4);// * Input.Maximum_range * Input.Maximum_range * Input.Maximum_range;
        var wavelength_exp_2 = Math.pow(Input.Wavelength, 2);// * Input.Wavelength;
        Input.RCS_Rmax = MyUtil.toPrecision((0.8*(max_range_exp_4)*Input.cube_4pi*Input.kB*Input.T0_K*1000000*1000000)/(0.001*Input.loss_linear*(wavelength_exp_2)*Input.Number_of_RX*Input.Chirp_duration*Input.Number_of_chirps),6);
        Input.Rmax_RCS_desired = MyUtil.toPrecision(Math.sqrt(Math.sqrt((0.001 * Input.RCS_desired * Input.loss_linear * (wavelength_exp_2) *
        Input.Number_of_RX*Input.Chirp_duration*Input.Number_of_chirps)/(0.8*Input.cube_4pi*Input.kB*Input.T0_K*1000000*1000000))),3);

        Input.Single_chirp_time = MyUtil.toPrecision(Input.Total_BW + Input.Inter_chirp_duration, 2);

        if (Input.subprofile_type != 'best_vel_res') {
            Input.v_max_high = MyUtil.toFloor((Input.lightSpeed * 1000) / (4 * Input.Frequency_band * (Input.Chirp_duration + Input.Min_Interchirp_dur) * Input.Number_of_TX), 2);
            Input.v_max_low = MyUtil.toCeil((Input.lightSpeed * 1000) / (4 * Input.Frequency_band * (Input.Chirp_duration + Input.max_inter_chirp_duration) * Input.Number_of_TX), 2);
        } else {
            Input.v_max_high = Input.Radial_velocity_Resolution * Input.max_number_of_chirps / (2 * Input.Number_of_TX); // VR sheet
            Input.v_max_low = Input.Radial_velocity_Resolution * N_fft2d_lo / 2; // VR sheet
        }

        if (Input.subprofile_type == 'best_range_res' || Input.subprofile_type == 'best_range') { // or best range
            radialVelocityConstraints1(Input.v_max_low, Input.v_max_high, 0.01);//RR, best range
        } else {
            radialVelocityConstraints2(Input.v_max_low, Input.v_max_high, N_fft2d_lo, Input.max_number_of_chirps / Input.Number_of_TX);
        }

        // raidal velocity resolution constraints
        // radial_vel_res = max_radial_vel/ (N_fft2d/2) = max_radial_vel/ (N_chirps/(2*Tx)) = max_radial_vel*2*Tx/N_chirps
        // N_chirps = N_fft2d * Tx
        Input.vel_res_high = MyUtil.toCeil(Input.Maximum_radial_velocity * 2 / N_fft2d_lo, 2);
        Input.vel_res_low = MyUtil.toCeil(Input.Maximum_radial_velocity * 2 * Input.Number_of_TX / Input.max_number_of_chirps, 2);

        if (Input.subprofile_type == 'best_range_res' || Input.subprofile_type == 'best_range') {
            velocityResolutionConstraints1(Input.max_number_of_chirps, Input.Number_of_TX, N_fft2d_lo, Input.Maximum_radial_velocity, Input.Doppler_FFT_size);//RR, best range
            var valueN2d = parseInt(templateObj.$.ti_widget_droplist_radial_vel_resolution.selectedValue, 10);
            if (isNaN(valueN2d)) {
            } else {
                Input.N_fft2d = valueN2d;
            }
            if (Input.N_fft2d) { // RR, best range
                // radial velocity resolutoin derived values
                Input.Doppler_FFT_size = Input.N_fft2d;
                Input.Number_of_chirps = Input.N_fft2d * Input.Number_of_TX;
                Input.Radial_velocity_Resolution = MyUtil.toCeil(Input.Maximum_radial_velocity / (Input.N_fft2d / 2), 2);
            }
        } else if (Input.subprofile_type == 'best_vel_res') {
            //radial_velocity_resolution
            velocityResolutionConstraints2(Input.Radial_velocity_Resolution);
        }

        //TODO?
        brief(Input);
    };

    var brief = function (Input) {
        //templateObj.$.ti_widget_input_range_res_sel.value = Input.Range_Resolution;
        templateObj.$.ti_widget_input_range_res_sel.label = Input.Range_Resolution;
        templateObj.$.ti_widget_input_max_range_sel.label = Input.Maximum_range;
        templateObj.$.ti_widget_input_max_radial_vel_sel.label = Input.Maximum_radial_velocity;
        templateObj.$.ti_widget_input_radial_vel_res_sel.label = Input.Radial_velocity_Resolution;
        templateObj.$.ti_widget_value_rcs_rmax.label = Input.RCS_Rmax;
        templateObj.$.ti_widget_value_rmax_rcs_desired.label = Input.Rmax_RCS_desired;
        templateObj.$.ti_widget_input_frame_rate.label = Input.Frame_Rate;

    };

    // takes uint16 version number and converts to 0xabcd
    var getVersionString = function (verUint16) {
        var hexStr = Number(verUint16).toString(16); //convert to hec
        hexStr = "0000".substr(0, 4 - hexStr.length) + hexStr; //make width=4 by adding zeros
        hexStr = hexStr.substr(0, 2) + '.' + hexStr.substr(2, 2); //separate into major/minor
        return hexStr;
    }

    var generate_ChannelCfg = function (Input, P) {
        if (Input.Number_of_RX == 4) P.channelCfg.rxChannelEn = 15;
        else if (Input.Number_of_RX == 3) P.channelCfg.rxChannelEn = 7;
        else if (Input.Number_of_RX == 2) P.channelCfg.rxChannelEn = 3;
        else if (Input.Number_of_RX == 1) P.channelCfg.rxChannelEn = 2;
        else P.channelCfg.rxChannelEn = 0;
        //P.channelCfg.txChannelEn=IF(Number_of_TX=3,7,IF(Number_of_TX=2,5,IF(Number_of_TX=1,1,0)))
        if ((Input.platform == Platform.xWR18xx) ||
            (Input.platform == Platform.xWR64xx) ||        
            (Input.platform == Platform.xWR68xx)) 
        {
            if (Input.Number_of_TX == 3) P.channelCfg.txChannelEn = 7;
            else if (Input.Number_of_TX == 2) P.channelCfg.txChannelEn = 5;
            else if (Input.Number_of_TX == 1) P.channelCfg.txChannelEn = 1;
            else P.channelCfg.txChannelEn = 0;
        } 
        else if (Input.platform == Platform.xWR16xx) 
        {
            if (Input.Number_of_TX == 2) P.channelCfg.txChannelEn = 3;
            else if (Input.Number_of_TX == 1) P.channelCfg.txChannelEn = 1;
            else P.channelCfg.txChannelEn = 0;
        } 
        else if (Input.platform == Platform.xWR68xx_AOP) 
        {
            /*Enable all TX channels on AOP to allow users
              to change configuration without power cycle of platform*/
            P.channelCfg.txChannelEn = 7;        
        } 
        else if (Input.platform == Platform.xWR18xx_AOP) 
        {
            /*Enable all TX channels on AOP to allow users
              to change configuration without power cycle of platform*/
            P.channelCfg.txChannelEn = 7;        
        }         
        else 
        {
            P.channelCfg.txChannelEn = 0;
        }

        P.channelCfg.cascading = 0;
        P.lines.push(['channelCfg', P.channelCfg.rxChannelEn, P.channelCfg.txChannelEn, P.channelCfg.cascading].join(' '));
    }

    var generate_adcCfg = function (Input, P) {
        P.adcCfg.numADCBits = 2; //=IF(ADC_bits=16,2,"NA")
        P.adcCfg.adcOutputFmt = Input.ADC_samples_type == 2 ? 1 : 0; //=IF(ADC_samples_type=2,1,0)
        P.adcCfg.justification = 0;//TODO remove
        P.lines.push(['adcCfg', P.adcCfg.numADCBits, P.adcCfg.adcOutputFmt].join(' '));
    }

    var generate_adcbufCfg = function (Input, P) {
        P.dataFmt.rxChannelEn = P.channelCfg.rxChannelEn;
        P.dataFmt.adcOutputFmt = Input.ADC_samples_type == 2 ? 0 : 1;//=IF(ADC_samples_type=2,0,1)
        P.dataFmt.chirpThreshold = Input.chirps_per_interrupt;
        P.dataFmt.SampleSwap = 1;
        
        P.dataFmt.ChanInterleave = 1;
        P.lines.push(['adcbufCfg -1', P.dataFmt.adcOutputFmt, P.dataFmt.SampleSwap, P.dataFmt.ChanInterleave, P.dataFmt.chirpThreshold].join(' '));
    }

    var generate_profileCfg = function (Input, P) {
        P.profileCfg.profileId = 0;
        P.profileCfg.startFreq = Input.Frequency_band;
        P.profileCfg.idleTime = Input.Inter_chirp_duration;
        P.profileCfg.adcStartTime = Input.Chirp_Start_Time;
        P.profileCfg.rampEndTime = Input.Chirp_duration;
        P.profileCfg.txOutPower = 0;
        P.profileCfg.txPhaseShifter = 0;
        P.profileCfg.freqSlopeConst = Input.Ramp_Slope;
        P.profileCfg.txStartTime = 1;
        P.profileCfg.numAdcSamples = Input.Num_ADC_Samples;
        P.profileCfg.digOutSampleRate = Input.ADC_Sampling_Rate * 1000;
        P.profileCfg.hpfCornerFreq1 = 0;
        P.profileCfg.hpfCornerFreq2 = 0;
        if ((Input.platform == Platform.xWR64xx)||
            (Input.platform == Platform.xWR68xx)||
            (Input.platform == Platform.xWR68xx_AOP))
        {
            /* RX gain = 30, RF gain target(bit 7:6) =0x10b -36dB */
            P.profileCfg.rxGain = 158;
        }
        else
        {
            /* RX gain = 30, RF gain target(bit 7:6) =0x00b - 30dB */  
            P.profileCfg.rxGain = 30;
        }
        P.lines.push(['profileCfg', P.profileCfg.profileId, P.profileCfg.startFreq, P.profileCfg.idleTime, P.profileCfg.adcStartTime, P.profileCfg.rampEndTime,
            P.profileCfg.txOutPower, P.profileCfg.txPhaseShifter, P.profileCfg.freqSlopeConst, P.profileCfg.txStartTime, P.profileCfg.numAdcSamples,
            P.profileCfg.digOutSampleRate, P.profileCfg.hpfCornerFreq1, P.profileCfg.hpfCornerFreq2, P.profileCfg.rxGain].join(' '));
    }

    var generate_chirpCfg = function (Input, P) {
        var chirpCfg = {}; P.chirpCfg.push(chirpCfg);
        
        if(Input.platform == Platform.xWR68xx_AOP)
        {
            /* For xWR68xx_AOP antenna pattern:
                TX antenna(s) num |  Azimuth resolution | Elevation resolution     
                  0               |  60                 | 60    - referred as Azimuth_Resolution == '60 + 60'
                  0,1             |  60                 | 30
                  0,2             |  N/A                | N/A   - referred as "Diagonal"       
                  1,2             |  30                 | 60
                  0,1,2           |  30                 | 30
            */      
        
            /************ First chirp ****************/
            chirpCfg.startIdx = 0;
            chirpCfg.endIdx = 0;
            chirpCfg.profileId = 0;
            chirpCfg.startFreq = 0;
            chirpCfg.freqSlopeVar = 0;
            chirpCfg.idleTime = 0;
            chirpCfg.adcStartTime = 0;
            
            if ((Input.Azimuth_Resolution == '60 + 60')||
                (Input.Azimuth_Resolution == '60 + 30')||
                (Input.Azimuth_Resolution == 'Diagonal')||
                (Input.Azimuth_Resolution == '30 + 30'))
            {
                /*first chirp on TX 0*/
                chirpCfg.txEnable = 1;
            }            
            else if (Input.Azimuth_Resolution == '30 + 60')
            {
                /*first chirp on TX 1*/
                chirpCfg.txEnable = 2;
            }            
            
            /************ Second chirp ****************/
                
            if (Input.Azimuth_Resolution != '60 + 60')
            {              
                chirpCfg = {}; P.chirpCfg.push(chirpCfg);
                chirpCfg.startIdx = 1;
                chirpCfg.endIdx = 1;
                chirpCfg.profileId = 0;
                chirpCfg.startFreq = 0;
                chirpCfg.freqSlopeVar = 0;
                chirpCfg.idleTime = 0;
                chirpCfg.adcStartTime = 0;
                if((Input.Azimuth_Resolution == '60 + 30') ||
                   (Input.Azimuth_Resolution == '30 + 30'))
                {                    
                    /*second chirp on TX 1*/
                    chirpCfg.txEnable = 2;
                }    
                else
                {                    
                    /*second chirp on TX 2*/
                    chirpCfg.txEnable = 4;
                }
            }
            
            /************ Third chirp ****************/
                
            if (Input.Azimuth_Resolution == '30 + 30')
            {              
                chirpCfg = {}; P.chirpCfg.push(chirpCfg);
                chirpCfg.startIdx = 2;
                chirpCfg.endIdx = 2;
                chirpCfg.profileId = 0;
                chirpCfg.startFreq = 0;
                chirpCfg.freqSlopeVar = 0;
                chirpCfg.idleTime = 0;
                chirpCfg.adcStartTime = 0;
                /*third chirp on TX 2*/
                chirpCfg.txEnable = 4;
            }   
        }  
        else if(Input.platform == Platform.xWR18xx_AOP)
        {
            /* For xWR18xx_AOP antenna pattern:
                TX antenna(s) num |  Azimuth resolution | Elevation resolution     
                  0,1             |  30                 | 60
                  0,1,2           |  30                 | 38
            */      
        
            /************ First chirp ****************/
            chirpCfg.startIdx = 0;
            chirpCfg.endIdx = 0;
            chirpCfg.profileId = 0;
            chirpCfg.startFreq = 0;
            chirpCfg.freqSlopeVar = 0;
            chirpCfg.idleTime = 0;
            chirpCfg.adcStartTime = 0;
            /*first chirp on TX 0*/
            chirpCfg.txEnable = 1;            

            /************ Second chirp ****************/
            chirpCfg = {}; P.chirpCfg.push(chirpCfg);
            chirpCfg.startIdx = 1;
            chirpCfg.endIdx = 1;
            chirpCfg.profileId = 0;
            chirpCfg.startFreq = 0;
            chirpCfg.freqSlopeVar = 0;
            chirpCfg.idleTime = 0;
            chirpCfg.adcStartTime = 0;
              
            /*second chirp on TX 1*/
            chirpCfg.txEnable = 2;


            /************ Third chirp ****************/
                
            if (Input.Azimuth_Resolution == '30 + 38')
            {              
                chirpCfg = {}; P.chirpCfg.push(chirpCfg);
                chirpCfg.startIdx = 2;
                chirpCfg.endIdx = 2;
                chirpCfg.profileId = 0;
                chirpCfg.startFreq = 0;
                chirpCfg.freqSlopeVar = 0;
                chirpCfg.idleTime = 0;
                chirpCfg.adcStartTime = 0;
                /*third chirp on TX 2*/
                chirpCfg.txEnable = 4;
            }               
        }
        else
        {
            chirpCfg.startIdx = 0;
            chirpCfg.endIdx = 0;
            chirpCfg.profileId = 0;
            chirpCfg.startFreq = 0;
            chirpCfg.freqSlopeVar = 0;
            chirpCfg.idleTime = 0;
            chirpCfg.adcStartTime = 0;
            //chirpCfg.txEnable = 1;
            if ((Input.platform == Platform.xWR18xx) ||
                (Input.platform == Platform.xWR64xx) ||
                (Input.platform == Platform.xWR68xx)) 
            {
                if (Input.Number_of_TX == 3) chirpCfg.txEnable = 1;
                else if (Input.Number_of_TX == 2) chirpCfg.txEnable = 1;
                else chirpCfg.txEnable = 1;
            } 
            else if (Input.platform == Platform.xWR16xx) 
            {
                if (Input.Number_of_TX == 2) chirpCfg.txEnable = 1;
                else chirpCfg.txEnable = 1;
            } 
            else 
            {
                chirpCfg.txEnable = 0;
            }
            
            chirpCfg = {}; P.chirpCfg.push(chirpCfg);
            chirpCfg.startIdx = 1;
            chirpCfg.endIdx = 1;
            chirpCfg.profileId = 0;
            chirpCfg.startFreq = 0;
            chirpCfg.freqSlopeVar = 0;
            chirpCfg.idleTime = 0;
            chirpCfg.adcStartTime = 0;
            if ((Input.platform == Platform.xWR18xx) ||
                (Input.platform == Platform.xWR64xx) ||
                (Input.platform == Platform.xWR68xx)) 
            {
                if (Input.Number_of_TX == 3) chirpCfg.txEnable = 4;
                else if (Input.Number_of_TX == 2) chirpCfg.txEnable = 4;
                else chirpCfg.txEnable = 0;
            } else if (Input.platform == Platform.xWR16xx) {
                if (Input.Number_of_TX == 2) chirpCfg.txEnable = 2;
                else chirpCfg.txEnable = 0;
            } else {
                chirpCfg.txEnable = 0;
            }
            
            if (((Input.platform == Platform.xWR18xx) ||
                 (Input.platform == Platform.xWR64xx) ||
                 (Input.platform == Platform.xWR68xx)) && Input.Number_of_TX == 3) { // TODO 3D case
                chirpCfg = {}; P.chirpCfg.push(chirpCfg);
                chirpCfg.startIdx = 2;
                chirpCfg.endIdx = 2;
                chirpCfg.profileId = 0;
                chirpCfg.startFreq = 0;
                chirpCfg.freqSlopeVar = 0;
                chirpCfg.idleTime = 0;
                chirpCfg.adcStartTime = 0;
                chirpCfg.txEnable = 2;
            }            
        }
        
        
        for (var idx = 0; idx < P.chirpCfg.length; idx++) {
            chirpCfg = P.chirpCfg[idx];
            P.lines.push(['chirpCfg', chirpCfg.startIdx, chirpCfg.endIdx, chirpCfg.profileId, chirpCfg.startFreq, chirpCfg.freqSlopeVar,
                chirpCfg.idleTime, chirpCfg.adcStartTime, chirpCfg.txEnable].join(' '));
        }
    }

    var generate_frameCfg = function (Input, P) {
        P.frameCfg.chirpStartIdx = 0;
        P.frameCfg.chirpEndIdx = Input.Number_of_TX - 1;
        P.frameCfg.numLoops = Input.Number_of_chirps / (P.frameCfg.chirpEndIdx - P.frameCfg.chirpStartIdx + 1);
        P.frameCfg.numFrames = 0;
        P.frameCfg.framePeriodicity = Input.Frame_duration;
        P.frameCfg.triggerSelect = 1;
        P.frameCfg.frameTriggerDelay = 0;
        P.lines.push(['frameCfg', P.frameCfg.chirpStartIdx, P.frameCfg.chirpEndIdx, P.frameCfg.numLoops, P.frameCfg.numFrames,
            P.frameCfg.framePeriodicity, P.frameCfg.triggerSelect, P.frameCfg.frameTriggerDelay].join(' '));
    }

    var generate_guiMonitorCfg = function (Input, P) {
        P.guiMonitor.detectedObjects = templateObj.$.ti_widget_checkbox_scatter_plot.checked ? 1 : 0;
        P.guiMonitor.logMagRange = templateObj.$.ti_widget_checkbox_range_profile.checked ? 1 : 0;
        P.guiMonitor.noiseProfile = templateObj.$.ti_widget_checkbox_noise_profile.checked ? 1 : 0;
        P.guiMonitor.rangeAzimuthHeatMap = templateObj.$.ti_widget_checkbox_azimuth_heatmap.checked ? 1 : 0;
        P.guiMonitor.rangeDopplerHeatMap = templateObj.$.ti_widget_checkbox_doppler_heatmap.checked ? 1 : 0;
        P.guiMonitor.statsInfo = templateObj.$.ti_widget_checkbox_statistics.checked ? 1 : 0;
        
        P.lines.push(['guiMonitor -1', P.guiMonitor.detectedObjects, P.guiMonitor.logMagRange, P.guiMonitor.noiseProfile,
            P.guiMonitor.rangeAzimuthHeatMap, P.guiMonitor.rangeDopplerHeatMap, P.guiMonitor.statsInfo].join(' '));
    }

    var generate_cfarCfg = function (Input, P) {
        var cfarCfg = {}; 
        
        //CFAR range
        P.cfarRangeCfg = cfarCfg;
        
        cfarCfg.noiseAvgWindowLength = 8;        
        cfarCfg.guardLength = 4;
        //for CFAR range DPU (DSP or HWA) cyclic mode should always be disabled
        cfarCfg.cyclicMode = 0;       
        if(Input.sdkVersionUint16 < 0x0302)
        {        
            cfarCfg.thresholdScale = convertSensitivitydBToLinear(Input.Range_Sensitivity, Input.platform, Input.Num_Virt_Ant, Input.sdkVersionUint16);
        }
        else
        {
            /* threshold in dB*/
            cfarCfg.thresholdScale = Input.Range_Sensitivity;
        }        
        cfarCfg.avgMode = 2;
        if (cfarCfg.avgMode != 0) //CAGO or CASO
        {
            cfarCfg.noiseSumDivisorAsShift = Math.ceil(Math.log2(cfarCfg.noiseAvgWindowLength));
        } else {
            cfarCfg.noiseSumDivisorAsShift = Math.ceil(Math.log2(2 * cfarCfg.noiseAvgWindowLength));
        }
        cfarCfg.peakGroupingEn = defaultRangePeakGrouping;
        
        P.lines.push(['cfarCfg -1 0', cfarCfg.avgMode, cfarCfg.noiseAvgWindowLength, cfarCfg.guardLength, cfarCfg.noiseSumDivisorAsShift,
            cfarCfg.cyclicMode, cfarCfg.thresholdScale, cfarCfg.peakGroupingEn].join(' '));
        
        //CFAR doppler 
        cfarCfg = {}; 
        P.cfarDopplerCfg = cfarCfg;
        cfarCfg.avgMode = 0;
        // reduce the window and guard length for smaller FFT
        if (Input.Doppler_FFT_size == 16) {
            cfarCfg.noiseAvgWindowLength = 4;
            cfarCfg.guardLength = 2;
        } else {
            cfarCfg.noiseAvgWindowLength = 8;
            cfarCfg.guardLength = 4;
        }
        if (cfarCfg.avgMode != 0) //CAGO or CASO
        {
            cfarCfg.noiseSumDivisorAsShift = Math.ceil(Math.log2(cfarCfg.noiseAvgWindowLength));
        } else {
            cfarCfg.noiseSumDivisorAsShift = Math.ceil(Math.log2(2 * cfarCfg.noiseAvgWindowLength));
        }
        
        if(Input.sdkVersionUint16 < 0x0302)
        {        
            cfarCfg.thresholdScale = convertSensitivitydBToLinear(Input.Doppler_Sensitivity, Input.platform, Input.Num_Virt_Ant, Input.sdkVersionUint16);
        }
        else
        {
            /* threshold in dB*/
            cfarCfg.thresholdScale = Input.Doppler_Sensitivity;
        }        
        
        //for CFAR doppler DPU (DSP or HWA) cyclic mode should always be enabled
        cfarCfg.cyclicMode = 1; 
        cfarCfg.peakGroupingEn = defaultDopplerPeakGrouping;
        
        P.lines.push(['cfarCfg -1 1', cfarCfg.avgMode, cfarCfg.noiseAvgWindowLength, cfarCfg.guardLength, cfarCfg.noiseSumDivisorAsShift,
                cfarCfg.cyclicMode, cfarCfg.thresholdScale, cfarCfg.peakGroupingEn].join(' '));
    }

    var defaultRangePeakGrouping = 1;
    var defaultDopplerPeakGrouping = 1;
    

    var generate_BFCfg = function (Input, P) {
    
        var multiObjBeamForming = {};
        multiObjBeamForming.enabled = 1;
        multiObjBeamForming.threshold = 0.5;
        
        P.lines.push(['multiObjBeamForming -1', multiObjBeamForming.enabled, multiObjBeamForming.threshold].join(' '));
    }

    var generate_clutterCfgDynamic = function (Input, P) {
        P.clutterRemoval.enabled = templateObj.$.ti_widget_checkbox_clutter_removal.checked ? 1 : 0;
        
        P.lines.push(['clutterRemoval -1', P.clutterRemoval.enabled].join(' '));
    }
    
    var defaultClutterCfg = 0;
    
    var generate_clutterCfg = function (Input, P) {
        P.clutterRemoval.enabled = defaultClutterCfg;
        
        P.lines.push(['clutterRemoval -1', P.clutterRemoval.enabled].join(' '));
    }
    
    var generate_DcRangeCfg = function (Input, P) {
        var calibDcRangeSig = {};
        calibDcRangeSig.enabled = 0;
        calibDcRangeSig.negativeBinIdx = -5;
        calibDcRangeSig.positiveBinIdx = 8;
        calibDcRangeSig.numAvgChirps = 256;

        P.lines.push(['calibDcRangeSig -1', calibDcRangeSig.enabled, calibDcRangeSig.negativeBinIdx, calibDcRangeSig.positiveBinIdx, calibDcRangeSig.numAvgChirps].join(' '));
    }

    var generate_extendedVeloCfg = function (Input, P) {
        var extendedMaxVelocity = {};
        extendedMaxVelocity.enabled = 0;

        if (Input.sdkVersionUint16 >= 0x0302)
        {
            P.lines.push(['extendedMaxVelocity -1', extendedMaxVelocity.enabled].join(' '));
        }
    }

    var generate_lowPowerCfg = function (Input, P) {
        var lowPower = {};

        if (Input.platform == Platform.xWR16xx) 
        {
            lowPower.lpAdcMode = 1;
        }
        else 
        {
            /* Low power disabled */
            lowPower.lpAdcMode = 0;
        }

        P.lines.push(['lowPower 0', lowPower.lpAdcMode].join(' '));
    }

    var generate_bpmCfg = function (Input, P) {
        var bpmCfg = {};
        bpmCfg.enabled = 0;
        bpmCfg.chirp0Idx = 0;
        bpmCfg.chirp1Idx = 1;
        if ((Input.platform == Platform.xWR16xx)||
            ((Input.platform == Platform.xWR68xx) && (Input.sdkVersionUint16 >= 0x0302)))
        {
            P.lines.push(['bpmCfg -1', bpmCfg.enabled, bpmCfg.chirp0Idx, bpmCfg.chirp1Idx].join(' '));
        }
    }

    var generate_lvdsStreamCfg = function (Input, P) {
        var lvdsStreamCfg = {};
        lvdsStreamCfg.isHeaderEnabled = 0;
        lvdsStreamCfg.dataFmt = 0;
        lvdsStreamCfg.isSwEnabled = 0;

        if(Input.sdkVersionUint16 >= 0x0302)
        {
            P.lines.push(['lvdsStreamCfg -1', lvdsStreamCfg.isHeaderEnabled, lvdsStreamCfg.dataFmt, lvdsStreamCfg.isSwEnabled].join(' '));
        }
    }

    var generate_nearFieldCfg = function (Input, P) {
        var nearFieldCfg = {};
        nearFieldCfg.enabled = 0;
        nearFieldCfg.startRangeIdx = 0;
        nearFieldCfg.endRangeIdx = 0;
        
        P.lines.push(['nearFieldCfg -1', nearFieldCfg.enabled, nearFieldCfg.startRangeIdx,
            nearFieldCfg.endRangeIdx].join(' '));
    }

    var generate_compRangeBiasAndRxChanPhase = function (Input, P) {
        if (Input.platform == Platform.xWR16xx) 
        {
            P.lines.push('compRangeBiasAndRxChanPhase 0.0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0');
        } 
        else if((Input.platform == Platform.xWR18xx) || 
                (Input.platform == Platform.xWR64xx) ||                
                (Input.platform == Platform.xWR68xx)) 
        {
            P.lines.push('compRangeBiasAndRxChanPhase 0.0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0');
        }       
        else if(Input.platform == Platform.xWR68xx_AOP)
        {
            P.lines.push('compRangeBiasAndRxChanPhase 0.0 1 0 -1 0 1 0 -1 0 1 0 -1 0 1 0 -1 0 1 0 -1 0 1 0 -1 0');
        }  
        else if(Input.platform == Platform.xWR18xx_AOP)
        {
            P.lines.push('compRangeBiasAndRxChanPhase 0.0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0 1 0');
        }         
    }

    var generate_measureRangeBiasAndRxChanPhase = function (Input, P) {
        P.lines.push('measureRangeBiasAndRxChanPhase 0 1.5 0.2');
    }

    var generate_CQrxSat = function (Input, P) {
        var CQrxSatMon = {};
        var numPrimarySlices = 64;
        var primarySliceDuration = 4;
        var samplingTime;
        
        if(Input.sdkVersionUint16 >= 0x0302)
        {        
            samplingTime = Input.Num_ADC_Samples / Input.ADC_Sampling_Rate;
            primarySliceDuration = Math.ceil(samplingTime / 0.16 / 64);
	    // min Slice Duration is 4
            if (primarySliceDuration < 4) {
                primarySliceDuration = 4;
            }
	    // Use floor operation to make sure monitoring duration is not more than samplingTime
            numPrimarySlices = Math.floor(samplingTime / (0.16 * primarySliceDuration));
	    // numPrimarySlices cannot be more than 64
            while (numPrimarySlices > 64) {
                primarySliceDuration = primarySliceDuration + 1;
                numPrimarySlices = Math.floor(samplingTime / (0.16 * primarySliceDuration));
            }

            CQrxSatMon.profileIndx = P.profileCfg.profileId;
            CQrxSatMon.satMonSel = 3;
            CQrxSatMon.primarySliceDuration = primarySliceDuration;
            CQrxSatMon.numSlices = numPrimarySlices * 2 - 1;
            CQrxSatMon.rxChannelMask = 0;

            P.lines.push(['CQRxSatMonitor', CQrxSatMon.profileIndx, CQrxSatMon.satMonSel,
                CQrxSatMon.primarySliceDuration, CQrxSatMon.numSlices,
                CQrxSatMon.rxChannelMask].join(' '));
        }

    }

    var generate_CQSigImg = function (Input, P) {
        var CQSigImgMon = {};
        var numPrimarySlices = 64;
        var samplePerPriSlice = 4;

        if(Input.sdkVersionUint16 >= 0x0302)
        {           
            samplePerPriSlice = Math.ceil(Input.Num_ADC_Samples / 64);
	    // min Sample per Primary Slice is 4
            if (samplePerPriSlice < 4) {
                samplePerPriSlice = 4;
            }
	    // sample Per Pri Slice should be even
            if (samplePerPriSlice % 2 != 0) {
                samplePerPriSlice = samplePerPriSlice + 1;
            }
	    // Use floor operation to make sure monitoring samples are not more than ADC samples
            numPrimarySlices = Math.floor(Input.Num_ADC_Samples / samplePerPriSlice);
	    // Num Primary Slices cannot be more than 64
            while (numPrimarySlices > 64) {
                samplePerPriSlice = samplePerPriSlice + 1;
                numPrimarySlices = Math.floor(Input.Num_ADC_Samples / samplePerPriSlice);
            }

	    CQSigImgMon.profileIndx = P.profileCfg.profileId;
            CQSigImgMon.numSlices = numPrimarySlices * 2 - 1;
            CQSigImgMon.timeSliceNumSamples = samplePerPriSlice;

            P.lines.push(['CQSigImgMonitor', CQSigImgMon.profileIndx,
                CQSigImgMon.numSlices,
                CQSigImgMon.timeSliceNumSamples].join(' '));
        }
    }

    var generate_analogMon = function (Input, P) {
        var analogMon = {};
       if(Input.sdkVersionUint16 >= 0x0302)
       {
            analogMon.rxSatMonEn = 0;
            analogMon.sigImgMonEn = 0;

            P.lines.push(['analogMonitor',
                analogMon.rxSatMonEn,
                analogMon.sigImgMonEn].join(' '));
        }
    }

    var generate_calibData = function (Input, P) {

        if(Input.sdkVersionUint16 >= 0x0305)
        {
	        if(Input.saveRestore == 'Save')
	        {
	            //mode 2 - enable boot calibration and save data in flash
	            P.lines.push(['calibData 1 0', Input.flashOffset].join(' '));
	        }
	        else if(Input.saveRestore == 'Restore')
	        {
	            //mode 3 - disable boot calibration and restore data from flash
	            P.lines.push(['calibData 0 1', Input.flashOffset].join(' '));
	        }
	        else
	        {
	            //mode 1 - enable boot calibration but do not save data
	            P.lines.push('calibData 0 0 0');
	        }
        }
    }


    var generate_aoaFovCfg = function (Input, P) {
        
        var aoaFovCmd = {};
        //Initialize AoA FoV to maximum
        aoaFovCmd.minAzimuthDeg   = -90;
        aoaFovCmd.maxAzimuthDeg   = 90;
        aoaFovCmd.minElevationDeg = -90;
        aoaFovCmd.maxElevationDeg = 90;
        P.lines.push(['aoaFovCfg -1', 
                     aoaFovCmd.minAzimuthDeg,
                     aoaFovCmd.maxAzimuthDeg,   
                     aoaFovCmd.minElevationDeg, 
                     aoaFovCmd.maxElevationDeg].join(' '));
    }
    
    var generate_cfarFovCfg = function (Input, P) {
        var cfarFovCmd = {};
        
        //********************* RANGE ********************************************
        //Initialize range FoV to maximum
        //computing max range in meters
        var rangeMeters_Input = 300 * 0.8 * P.profileCfg.digOutSampleRate /
            (2 * P.profileCfg.freqSlopeConst * 1e3);
        
        cfarFovCmd.procDirection = 0;//range
        cfarFovCmd.min    = 0;
        //keep only 2 decimals
        cfarFovCmd.max    = parseFloat(Math.floor(rangeMeters_Input * 100) / 100).toFixed(2);
        
        P.lines.push(['cfarFovCfg -1', 
                     cfarFovCmd.procDirection,
                     cfarFovCmd.min   ,   
                     cfarFovCmd.max].join(' '));

        //********************* DOPPLER ********************************************                         
        //Initialize doppler FoV to maximum
        //Computing Doppler limit in mps
        var dopplerMps_Input =  3e8 / (4 * P.profileCfg.startFreq * 1e9 *
                              (P.profileCfg.idleTime + P.profileCfg.rampEndTime) * 1e-6 * Input.Number_of_TX);
        
        //keep only 2 decimals
        dopplerMps_Input = parseFloat(Math.floor(dopplerMps_Input * 100) / 100).toFixed(2);
        
        cfarFovCmd.procDirection = 1;//Doppler
        cfarFovCmd.min    = -dopplerMps_Input;
        cfarFovCmd.max    =  dopplerMps_Input;
        P.lines.push(['cfarFovCfg -1', 
                     cfarFovCmd.procDirection,
                     cfarFovCmd.min   ,   
                     cfarFovCmd.max].join(' '));
    }
        
    var generateCfg = function () {
        var Input = this.Input;
        var P = {
            channelCfg: {}, adcCfg: {}, dataFmt: {}, profileCfg: {},
            chirpCfg: [], frameCfg: {}, guiMonitor: {}, clutterRemoval: {}, lines: []
        };

        P.lines.push('% ***************************************************************');

        P.lines.push(['% Created for SDK ver', getVersionString(Input.sdkVersionUint16)].join(':'));
        P.lines.push(['% Created using Visualizer ver', visualizerVersion].join(':'));
        P.lines.push(['% Frequency', Input.Frequency_band].join(':'));
        P.lines.push(['% Platform', Input.platform].join(':'));
        P.lines.push(['% Scene Classifier', Input.subprofile_type].join(':'));
        P.lines.push(['% Azimuth Resolution(deg)', Input.Azimuth_Resolution].join(':'));
        P.lines.push(['% Range Resolution(m)', Input.Range_Resolution].join(':'));
        P.lines.push(['% Maximum unambiguous Range(m)', Input.Maximum_range].join(':'));
        P.lines.push(['% Maximum Radial Velocity(m/s)', Input.Maximum_radial_velocity].join(':'));
        P.lines.push(['% Radial velocity resolution(m/s)', Input.Radial_velocity_Resolution].join(':'));
        P.lines.push(['% Frame Duration(msec)', Input.Frame_duration].join(':'));
        P.lines.push(['% RF calibration data', Input.saveRestore].join(':'));
        if(Input.saveRestore != 'None')
        {
            P.lines.push(['% Flash address for RF calibration data', Input.flashOffset].join(':'));
        }
        /* start: comments for dynamic commands - should be remved when exporting tuned profile */
        P.lines.push(['% Range Detection Threshold (dB)', Input.Range_Sensitivity].join(':'));
        P.lines.push(['% Doppler Detection Threshold (dB)', Input.Doppler_Sensitivity].join(':'));
        P.lines.push(['% Range Peak Grouping', defaultRangePeakGrouping ? 'enabled' : 'disabled'].join(':'));
        P.lines.push(['% Doppler Peak Grouping', defaultDopplerPeakGrouping ? 'enabled' : 'disabled'].join(':'));        
        P.lines.push(['% Static clutter removal', defaultClutterCfg ? 'enabled' : 'disabled'].join(':'));        
        P.lines.push('% Angle of Arrival FoV: Full FoV');
        P.lines.push('% Range FoV: Full FoV');
        P.lines.push('% Doppler FoV: Full FoV');
        /* end: comments for dynamic commands - should be remved when exporting tuned profile */

        P.lines.push('% ***************************************************************');

        P.lines.push('sensorStop');
        P.lines.push('flushCfg');
        P.lines.push('dfeDataOutputMode 1');

        // channelCfg
        generate_ChannelCfg(Input, P);

        // adcCfg
        generate_adcCfg(Input, P);

        // dataFmt (adcbufCfg)
        generate_adcbufCfg(Input, P);

        // profileCfg
        generate_profileCfg(Input, P);

        // chirpCfg 
        generate_chirpCfg(Input, P);

        // frameCfg
        generate_frameCfg(Input, P);

        // lowPower
        generate_lowPowerCfg(Input, P);

        // guiMonitor
        generate_guiMonitorCfg(Input, P);

        // cfarCfg, cfarRangeCfg, cfarDopplerCfg
        generate_cfarCfg(Input, P);

        // multiObjBeamForming
        generate_BFCfg(Input, P);

        //Static clutter removal
        generate_clutterCfg(Input, P);

        //always disable calibDcRangeSig and fill in defaults (needed as they are checked by demo)
        generate_DcRangeCfg(Input, P);

        //always disable extendedMaxVelocity
        generate_extendedVeloCfg(Input, P);

        //always disable BPM
        generate_bpmCfg(Input, P);

        //always disable LVDS streaming
        generate_lvdsStreamCfg(Input, P);

        //always disable nearField
        //generate_nearFieldCfg(Input, P);

        // compensate range and angle based on input
        generate_compRangeBiasAndRxChanPhase(Input, P);

        // disable always
        generate_measureRangeBiasAndRxChanPhase(Input, P);

        // CQ rxSaturation
        generate_CQrxSat(Input, P);

        // CQ Signal Image band monitor
        generate_CQSigImg(Input, P);

        // Analog monitor
        generate_analogMon(Input, P);

        // aoaFovCfg
        generate_aoaFovCfg(Input, P);
        
        // cfarFovCfg
        generate_cfarFovCfg(Input, P);

        // calibData
        generate_calibData(Input, P);

        P.lines.push('sensorStart');
        return P;
    };

    mmWaveInput.prototype.init = init;
    mmWaveInput.prototype.updateInput = updateInput;
    mmWaveInput.prototype.generateCfg = generateCfg;
    mmWaveInput.prototype.Platform = Platform;
    mmWaveInput.prototype.isRR = isRR;
    mmWaveInput.prototype.isVR = isVR;
    mmWaveInput.prototype.isBestRange = isBestRange;
    mmWaveInput.prototype.setDefaultRangeResConfig = setDefaultRangeResConfig;
    mmWaveInput.prototype.setDefaultVelResConfig = setDefaultVelResConfig;
    mmWaveInput.prototype.setDefaultRangeConfig = setDefaultRangeConfig;
    mmWaveInput.prototype.generate_cfarCfg = generate_cfarCfg;
    mmWaveInput.prototype.generate_clutterCfgDynamic = generate_clutterCfgDynamic;
    mmWaveInput.prototype.convertSensitivityLinearTodB = convertSensitivityLinearTodB;
    mmWaveInput.prototype.convertSensitivitydBToLinear = convertSensitivitydBToLinear;
    
  

    // export as AMD/CommonJS module or global variable
    if (typeof define === 'function' && define.amd) define('mmWaveInput', function () { return mmWaveInput; });
    else if (typeof module !== 'undefined') module.exports = mmWaveInput;
    else if (typeof self !== 'undefined') self.mmWaveInput = mmWaveInput;
    else window.mmWaveInput = mmWaveInput;

})();


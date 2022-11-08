#!/usr/bin/env node
const program = require('commander');                                       // 命令行交互
const { execSync } = require('child_process');                              // 子进程操作
const path = require('path');                                               // 路径操作
const fs = require('fs');                                                   // 文件操作
const ora = require('ora');                                                 // 命令行
const chalk = require('chalk');                                             // 美化输出
const codeAnalysis = require(path.join(__dirname,'../lib/index'));          // 核心入口
const { writeReport } = require(path.join(__dirname, '../lib/report'));     // 文件工具

program
    .command('analysis')
    .description('analysis code and echo report')
    .action(async () => {
        try{
            const configPath =path.join(process.cwd(),'./analysis.config.js');
            const isConfig =fs.existsSync(configPath);
            if(isConfig){
                let config =require(configPath);
                if(config.scanSource && Array.isArray(config.scanSource) && config.scanSource.length>0){
                    let isParamsError = false;
                    let isCodePathError = false;
                    let unExistDir = '';
                    for (let i =0; i<config.scanSource.length; i++){
                        if(!config.scanSource[i].name || !config.scanSource[i].path || !Array.isArray(config.scanSource[i].path) || config.scanSource[i].path.length ==0){
                            isParamsError = true;
                            break;
                        }
                        let innerBreak = false;
                        const tempPathArr = config.scanSource[i].path;
                        for (let j =0; j<tempPathArr.length; j++){
                            const tempPath = path.join(process.cwd(), tempPathArr[j]);
                            if(!fs.existsSync(tempPath)){
                                isCodePathError = true;
                                unExistDir = tempPathArr[j];
                                innerBreak = true;
                                break;
                            }
                        }
                        if(innerBreak)break;
                    }
                    if(!isParamsError){
                        if(!isCodePathError){
                            if(config && config.analysisTarget){
                                // 如果分析报告目录已经存在，则先删除目录
                                const reportPath =path.join(process.cwd(),`./${config.reportDir}`);
                                const isReport =fs.existsSync(reportPath);
                                if(isReport){
                                    execSync(`rm -rf ${reportPath}`, {
                                        stdio: 'inherit',
                                    });
                                }
                                const spinner = ora(chalk.blue('analysis start')).start();
                                try{
                                    // 分析代码
                                    const report = await codeAnalysis(config);
                                    // 输出分析报告
                                    writeReport(config.reportDir, report);
                                    spinner.succeed(chalk.green('analysis success'));
                                    // 代码告警/正常退出
                                    if(config.scorePlugin && config.thresholdScore && typeof(config.thresholdScore) ==='number' && config.thresholdScore >0){
                                        if(report.scoreMap.score && report.scoreMap.score < config.thresholdScore){
                                            console.log(chalk.red('\n' + '代码得分：' + report.scoreMap.score + ', 不合格'));      // 输出代码分数信息
                                            if(report.scoreMap.message.length >0){                                              // 输出代码建议信息
                                                console.log(chalk.yellow('\n' + '优化建议：'));                           
                                                report.scoreMap.message.forEach((element, index) => {
                                                    console.log(chalk.yellow((index+1) + '. ' + element));
                                                });
                                            }
                                            console.log(chalk.red('=== 触发告警 ==='));                                        // 输出告警信息
                                            process.exit(2);                                                                  // 触发告警错误并结束进程
                                        }else{
                                            console.log(chalk.green('\n' + '代码得分：' + report.scoreMap.score));              // 输出代码分数信息
                                            if(report.scoreMap.message.length >0){                                            // 输出代码建议信息
                                                console.log(chalk.yellow('\n' + '优化建议：'));                           
                                                report.scoreMap.message.forEach((element, index) => {
                                                    console.log(chalk.yellow((index+1) + '. ' + element));
                                                });
                                            }
                                        }
                                    }else if(config.scorePlugin){
                                        console.log(chalk.green('\n' + '代码得分：' + report.scoreMap.score + '\n'));          // 输出代码分数信息
                                        if(report.scoreMap.message.length >0){                                               // 输出代码建议信息
                                            console.log(chalk.yellow('\n' + '优化建议：'));                           
                                            report.scoreMap.message.forEach((element, index) => {
                                                console.log(chalk.yellow((index+1) + '. ' + element));
                                            });
                                        }            
                                    }
                                }catch(e){
                                    spinner.fail(chalk.red('analysis fail'));
                                    console.log(chalk.red(e.stack));        // 输出错误信息
                                    process.exit(1);                        // 错误退出进程
                                }
                            }else{
                                console.log(chalk.red('error: 配置文件中缺少必填配置项analysisTarget'));
                            }
                        }else{
                            console.log(chalk.red(`error: 配置文件中待分析文件目录${unExistDir}不存在`));
                        }
                    }else{
                        console.log(chalk.red('error: scanSource参数选项必填属性不能为空'));
                    }
                }else{
                    console.log(chalk.red('error: 配置文件中必填配置项scanSource有误'))
                }
            }else{
                console.log(chalk.red('error: 缺少analysis.config.js配置文件'));
            }
        }catch(e){
            console.log(chalk.red(e.stack));
        }
    })

program.parse(process.argv)

var { ipcRenderer } = window.require('electron');
import React from 'react';
import { List, ListItem } from 'material-ui/List';
import IconButton from 'material-ui/IconButton';
import Drawer from 'material-ui/Drawer';
import Subheader from 'material-ui/Subheader';
import {Tabs, Tab} from 'material-ui/Tabs';
import { red500 } from 'material-ui/styles/colors';
import IconDelete from 'material-ui/svg-icons/action/cached';
import TextField from 'material-ui/TextField';
import SelectField from 'material-ui/SelectField';
import MenuItem from 'material-ui/MenuItem';

var TestcaseTextField = React.createClass({
	getInitialState() {
		return {
			value: this.props.value
		};
	},
	handleChange(event, value) {
		this.setState({value: value});
		if (value === '' || isNaN(Number(value))) return;
		var inst = this;
		var data = {
			testcase: inst.props.testcase,
			field: inst.props.field,
			value: value
		};
		ipcRenderer.send('add-problem-testcase-change', data);
	},
	render() {
		return (<TextField
					floatingLabelText={this.props.label + ' (-1 giữ mặc định)'}
					floatingLabelFixed={true}
					value={this.state.value}
					fullWidth={true}
					onChange={this.handleChange}
				/>);
	}
});

var GeneralTextField = React.createClass({
	getInitialState() {
		return {
			value: this.props.value
		};
	},
	handleChange(event, value) {
		var isNumber = (this.props.isNumber === undefined ? false : this.props.isNumber);
		this.setState({value: value});
		if (isNumber) if (value === '' || isNaN(Number(value))) return;
		var inst = this;
		var data = {
			field: inst.props.field,
			value: value
		};
		ipcRenderer.send('add-problem-general-change', data);
	},
	render() {
		return (<TextField
					floatingLabelText={this.props.label}
					floatingLabelFixed={true}
					value={this.state.value}
					fullWidth={true}
					disabled={this.props.disabled === undefined ? false : this.props.disabled}
					onChange={(this.props.disabled ? undefined : this.handleChange)}
				/>);
	}
});

var TestcaseListItem = React.createClass({
	getInitialState() {
		return {
			input: this.props.input,
			output: this.props.output
		};
	},
	handleFlip() {
		this.setState(function(prev) {
			return {
				input: prev.output,
				output: prev.input
			};
		});
		ipcRenderer.send('add-problem-testcase-flip', this.props.name);
	},
	render() {
		var InOut = (<span>
						<span>Input: <b>{this.state.input}</b></span>
						<span> / Output: <b>{this.state.output}</b></span>
					</span>);
		return (<ListItem
					leftAvatar={<IconButton
						tooltip={"Đảo ngược input và output"} style={{height: 48, weight: 48}}
						onClick={this.handleFlip}
					><IconDelete color={red500}/></IconButton>}
					primaryText={this.props.name}
					secondaryText={InOut}
					nestedItems={[
						<ListItem
							primaryText={
								<TestcaseTextField
									testcase={this.props.name}
									field='score'
									label='Điểm'
									value={this.props.score}
								/>
							}
						/>,
						<ListItem
							primaryText={
								<TestcaseTextField
									testcase={this.props.name}
									field='timeLimit'
									label='Giới hạn thời gian (giây)'
									value={this.props.timeLimit}
								/>
							}
						/>,
						<ListItem
							primaryText={
								<TestcaseTextField
									testcase={this.props.name}
									field='memoryLimit'
									label='Giới hạn bộ nhớ (kB)'
									value={this.props.memoryLimit}
								/>
							}
						/>
					]}
				/>);
	}
});

var GeneralSelectField = React.createClass({
	getInitialState() {
		return {
			value: this.props.value
		};
	},
	handleChange(event, key, value) {
		this.setState({value: value});
		var inst = this;
		var data = {
			field: inst.props.field,
			value: value
		};
		ipcRenderer.send('add-problem-general-change', data);
	},
	render() {
		var messages = this.props.messages;
		var message = (messages[this.state.value] === undefined ? '' : messages[this.state.value]);
		return (<SelectField
					value={this.state.value}
					onChange={this.handleChange}
					fullWidth={true}
					errorStyle={{color: 'orange'}}
					errorText={message}
					floatingLabelText={this.props.label}
					floatingLabelFixed={true}
				>
					{this.props.children}
				</SelectField>);
	}
});

var GeneralContent = React.createClass({
	render() {
		var messages = {
			'C8CompileThemis.dll': 'Hãy đảm bảo có mặt file checker.pas hoặc checker.cpp để biên dịch',
			'C9CompileTestlib.dll': 'Hãy đảm bảo có mặt file checker.pas hoặc checker.cpp để biên dịch',
			'C10CompileCMS.dll': 'Hãy đảm bảo có mặt file checker.pas hoặc checker.cpp để biên dịch',
			'C11GraderDiff.dll': 'Hãy đảm bảo có mặt file grader.pas VÀ grader.cpp để biên dịch'
		};
		return (<div className='rows'>
					<div className='col-xs-10 col-xs-offset-1'>
						<GeneralTextField
							field='name'
							label='Tên bài tập'
							value={this.props.config.name}
							disabled={true}
						/>
						<GeneralTextField
							field='score'
							label='Điểm cho mỗi test'
							value={this.props.config.score}
							isNumber={true}
						/>
						<GeneralTextField
							field='timeLimit'
							label='Giới hạn thời gian (giây)'
							value={this.props.config.timeLimit}
							isNumber={true}
						/>
						<GeneralTextField
							field='memoryLimit'
							label='Giới hạn bộ nhớ (kB)'
							value={this.props.config.memoryLimit}
							isNumber={true}
						/>
						<GeneralSelectField
							field='evaluator'
							label='Phương thức chấm'
							value={this.props.config.evaluator}
							messages={messages}
						>
							<MenuItem value='C2LinesWordsCase.dll' primaryText='Diff'/>
							<MenuItem value='C1LinesWordsIgnoreCase.dll' primaryText='Diff không phân biệt hoa thường'/>
							<MenuItem value='C4WordsCase.dll' primaryText='Diff không phân biệt dấu trắng'/>
							<MenuItem value='C3WordsIgnoreCase.dll' primaryText='Diff không phân biệt dấu trắng, không phân biệt hoa thường'/>
							<MenuItem value='C5Binary.dll' primaryText='So sánh file nhị phân'/>
							<MenuItem value='C6AMM2External.dll' primaryText='Sử dụng trình chấm của AMM2 (Windows only)'/>
							<MenuItem value='C7External.dll' primaryText='Sử dụng trình chấm của Themis (Windows only)'/>
							<MenuItem value='C8CompileThemis.dll'
								primaryText='Sử dụng trình chấm của Themis (biên dịch trình chấm)'
							/>
							<MenuItem value='C9CompileTestlib.dll'
								primaryText='Sử dụng trình chấm theo chuẩn Testlib (biên dịch trình chấm)'
							/>
							<MenuItem value='C10CompileCMS.dll'
								primaryText='Sử dụng trình chấm của CMS (biên dịch trình chấm)'
							/>
							<MenuItem value='C11GraderDiff.dll'
								primaryText='Sử dụng grader, yêu cầu học sinh viết hàm, so sánh output bằng diff'
							/>
						</GeneralSelectField>
					</div>
				</div>);
	}
});

var AddProblemDrawer = React.createClass({
	getInitialState() {
		var inst = this;
		ipcRenderer.on('add-problem-drawer', function(event, testcases, config) {
			inst.setState({
				testcases: testcases,
				config: config,
				open: true
			});
		});
		return {
			testcases: [],
			config: {},
			open: false,
			state: 'testcases' // Only in testing, switch to 'general' in production
		};
	},
	handleTabChange(event, value) {
		this.setState(value);
	},
	handleChange(open) {
		this.setState({
			open: open
		});
		if (open === false) {
			this.setState({
				testcases: [],
				config: {}
			});
			ipcRenderer.send('add-problem-add');
		}
	},
	render() {
		var inst = this;
		var general = null;
		if (this.state.config.name !== undefined) {
			general = <GeneralContent config={this.state.config}/>;
		}
		var testcases = this.state.testcases.map(function(testcase, idx) {
			return (<TestcaseListItem
						name={testcase[2]}
						input={testcase[0]}
						output={testcase[1]}
						timeLimit={inst.state.config.testcases[idx].timeLimit}
						memoryLimit={inst.state.config.testcases[idx].memoryLimit}
						score={inst.state.config.testcases[idx].score}
					/>);
		});
		return (<Drawer
					docked={false}
					width={700}
					open={this.state.open}
					onRequestChange={this.handleChange}
				>
					<Subheader inset={true}>{<span>Thêm bài tập: {this.state.config.name}</span>}</Subheader>
					<Tabs value={this.state.value} onChange={this.handleTabChange}>
						<Tab label='Cấu hình chung' value='general'>
							{general}
						</Tab>
						<Tab label='Cấu hình các test' value='testcases'>
							<List>
								{testcases}
							</List>
						</Tab>
					</Tabs>
				</Drawer>);
	}
});

module.exports = AddProblemDrawer;

var { ipcRenderer } = window.require('electron');
import React from 'react';
import TextField from 'material-ui/TextField';
import SelectField from 'material-ui/SelectField';
import MenuItem from 'material-ui/MenuItem';
import { List, ListItem } from 'material-ui/List';
import { red500 } from 'material-ui/styles/colors';
import IconDelete from 'material-ui/svg-icons/action/cached';
import IconButton from 'material-ui/IconButton';

/**
 * Text-field for testcase-wise changes
 * @prop   	{string}	testcase	Name of the testcase
 * @prop   	{string}	field		The field to hold
 * @prop	{any}		value		The default value
 * @event	{any}		onChange	Fires the change through 'problem-testcase-change' channel
 */
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
		ipcRenderer.send('problem-testcase-change', data);
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
		ipcRenderer.send('problem-general-change', data);
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
		ipcRenderer.send('problem-general-change', data);
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
		var reverseInOut = (<IconButton
			tooltip={"Đảo ngược input và output"} style={{height: 48, weight: 48}}
			onClick={this.handleFlip}
		><IconDelete color={red500}/></IconButton>);
		if (this.props.configMode === true) {
			InOut = '';
			reverseInOut = '';
		}
		return (<ListItem
					leftAvatar={reverseInOut}
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
									value={this.props.memoryLimit}
									label='Giới hạn bộ nhớ (kB)'
								/>
							}
						/>
					]}
				/>);
	}
});

module.exports = {
	TestcaseTextField: TestcaseTextField,
	GeneralTextField: GeneralTextField,
	GeneralSelectField: GeneralSelectField,
	GeneralContent: GeneralContent,
	TestcaseListItem: TestcaseListItem
};

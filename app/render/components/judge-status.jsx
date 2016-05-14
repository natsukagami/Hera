var { ipcRenderer } = window.require('electron');
import React from 'react';
import CircularProgress from 'material-ui/CircularProgress';
import LinearProgress from 'material-ui/LinearProgress';
import FloatingActionButton from 'material-ui/FloatingActionButton';
import IconMenu from 'material-ui/IconMenu';
import IconContentAdd from 'material-ui/svg-icons/content/add';
import IconActionSettings from 'material-ui/svg-icons/action/settings';
import MenuItem from 'material-ui/MenuItem';

var JudgeStatusCircle = React.createClass({
	getInitialState() {
		return {
			'state': 'determinate',
			'minValue': 1,
			'maxValue': 1,
			'value': 1
		};
	},
	render() {
		if (this.state.state === 'determinate') {
			return (<CircularProgress
						mode={this.state.state}
						min={this.state.minValue}
						max={this.state.maxValue}
						value={this.state.value}
						size={1.5}
					/>);
		} else {
			return (<CircularProgress
						mode={this.state.state}
					/>);
		}
	}
});

var JudgeStatusBar = React.createClass({
	getInitialState() {
		var inst = this; // Instance
		ipcRenderer.on('judge-bar', function(event, data) {
			// 'reset'
			if (data === 'reset') {
				inst.setState({
					status: 'Máy chấm đang trong trạng thái nghỉ',
					maxValue: 1,
					value: 1,
					mode: 'indeterminate'
				});
				return;
			}
			//  An update object
			//  {
			//  [status]: (string),
			// 	[value]: [(mode: 'set' / 'add'), (int)],
			// 	[maxValue]: [(mode: 'set' / 'add'), (int)],
			// 	[mode]: "determinate" / "indeterminate"
			//  }
			inst.setState(function(prev, props) {
				var updateState = {};
				if (data.status) updateState.status = data.status;
				if (data.value) {
					if (data.value[0] === 'add')
						updateState.value = prev.value + data.value[1];
					else updateState.value = data.value[1];
				}
				if (data.maxValue) {
					if (data.maxValue[0] === 'add')
						updateState.maxValue = prev.maxValue + data.maxValue[1];
					else updateState.maxValue = data.maxValue[1];
				}
				if (data.mode) updateState.mode = data.mode;
				return updateState;
			});
		});
		return {
			status: 'Máy chấm đang trong trạng thái nghỉ',
			maxValue: 1,
			value: 1,
			mode: 'indeterminate'
		};
	},
	render() {
		return (<div style={{'verticalAlign': 'middle'}}>
					<div style={{'height': 40}}>
						<h3 style={{fontFamily: 'Roboto', fontWeight: 300}}>{this.state.status}</h3>
					</div>
					<div style={{'height': 40}}>
						<LinearProgress
							mode={this.state.mode}
							min={0}
							max={this.state.maxValue}
							value={this.state.value}
						/>
					</div>
				</div>);
	}
});

var JudgeToolbox = React.createClass({
	render() {
		return (<IconMenu
					iconButtonElement={
						<FloatingActionButton>
							<IconActionSettings/>
						</FloatingActionButton>
					}
					anchorOrigin={{horizontal: 'right', vertical: 'bottom'}}
					targetOrigin={{horizontal: 'right', vertical: 'bottom'}}
				>
					<MenuItem>Cấu hình bài tập</MenuItem>
					<MenuItem>Cấu hình máy chấm</MenuItem>
					<MenuItem>Cấu hình máy chủ nộp bài</MenuItem>
					<MenuItem>Chấm lại bài của các thí sinh đã chọn</MenuItem>
				</IconMenu>);
	}
});

var JudgeAddContent = React.createClass({
	handleAddContent(event, value) {
		if (value === null) return;
		ipcRenderer.send('add-' + value);
	},
	render() {
		return (<IconMenu
					iconButtonElement={
						<FloatingActionButton secondary={true}>
							<IconContentAdd/>
						</FloatingActionButton>
					}
					anchorOrigin={{horizontal: 'right', vertical: 'bottom'}}
					targetOrigin={{horizontal: 'right', vertical: 'bottom'}}
					onChange={this.handleAddContent}
				>
					<MenuItem value='problem'>Thêm bài tập...</MenuItem>
					<MenuItem value='student'>Nạp danh sách thí sinh...</MenuItem>
				</IconMenu>);
	}
});

var JudgeStatus = React.createClass({
	render() {
		return (<div className='row'>
			<div className='col-xs-2'>
				<JudgeStatusCircle/>
			</div>
			<div className='col-xs-8'>
				<JudgeStatusBar/>
			</div>
			<div className='col-xs-2' style={{paddingTop: '20px'}}>
				<JudgeAddContent/>
				<span style={{paddingLeft: '10px'}}><JudgeToolbox/></span>
			</div>
		</div>);
	}
});

export default JudgeStatus;

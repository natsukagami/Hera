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
		return {
			status: 'Máy chấm đang trong trạng thái nghỉ',
			totalCount: 1,
			totalCurrent: 1
		};
	},
	render() {
		return (<div style={{'verticalAlign': 'middle'}}>
					<div style={{'height': 40}}>
						<h3>{this.state.status}</h3>
					</div>
					<div style={{'height': 40}}>
						<LinearProgress
							mode='indeterminate'
							min={0}
							max={this.state.totalCount}
							value={this.state.totalCurrent}
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
	render() {
		return (<IconMenu
					iconButtonElement={
						<FloatingActionButton secondary={true}>
							<IconContentAdd/>
						</FloatingActionButton>
					}
					anchorOrigin={{horizontal: 'right', vertical: 'bottom'}}
					targetOrigin={{horizontal: 'right', vertical: 'bottom'}}
				>
					<MenuItem>Thêm bài tập...</MenuItem>
					<MenuItem>Thêm thí sinh...</MenuItem>
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
